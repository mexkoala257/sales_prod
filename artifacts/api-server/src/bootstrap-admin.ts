import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";

const MINIMUM_PASSWORD_LENGTH = 12;
const BOOTSTRAP_LOCK_ID = 682_913_445;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BootstrapAdminCredentials = {
  email: string;
  password: string;
};

type BootstrapRepository = {
  hasSuperAdmin: () => Promise<boolean>;
  createSuperAdmin: (user: { email: string; passwordHash: string }) => Promise<void>;
};

export function readBootstrapAdminCredentials(environment: NodeJS.ProcessEnv): BootstrapAdminCredentials {
  const email = environment.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !emailPattern.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  }

  if (!password || password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }

  if (password !== password.trim()) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must not start or end with whitespace.");
  }

  return { email, password };
}

export async function bootstrapFirstSuperAdmin(
  repository: BootstrapRepository,
  credentials: BootstrapAdminCredentials,
): Promise<"created" | "already_initialized"> {
  if (await repository.hasSuperAdmin()) {
    return "already_initialized";
  }

  const passwordHash = await bcrypt.hash(credentials.password, 12);
  await repository.createSuperAdmin({ email: credentials.email, passwordHash });
  return "created";
}

async function main() {
  let credentials: BootstrapAdminCredentials;
  let closePool: (() => Promise<void>) | undefined;

  try {
    credentials = readBootstrapAdminCredentials(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Bootstrap configuration is invalid.");
    process.exitCode = 1;
    return;
  }

  try {
    const { db, pool, usersTable } = await import("@workspace/db");
    closePool = () => pool.end();
    const result = await db.transaction(async (transaction) => {
      // This prevents two concurrent one-time bootstrap runs from both creating an admin.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_ID})`);

      return bootstrapFirstSuperAdmin(
        {
          hasSuperAdmin: async () => {
            const [existingAdmin] = await transaction
              .select({ id: usersTable.id })
              .from(usersTable)
              .where(eq(usersTable.role, "super_admin"))
              .limit(1);
            return Boolean(existingAdmin);
          },
          createSuperAdmin: async (user) => {
            await transaction.insert(usersTable).values({
              email: user.email,
              passwordHash: user.passwordHash,
              role: "super_admin",
              isActive: true,
            });
          },
        },
        credentials,
      );
    });

    if (result === "already_initialized") {
      console.error("Bootstrap stopped: a super-admin already exists. No accounts were changed.");
      process.exitCode = 2;
      return;
    }

    console.log("Initial super-admin created. Sign in through the super-admin login page.");
  } catch {
    console.error("Bootstrap failed. Check the database connection and bootstrap values, then try again.");
    process.exitCode = 1;
  } finally {
    await closePool?.();
  }
}

const isInvokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isInvokedDirectly) {
  await main();
}