import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import {
  bootstrapFirstSuperAdmin,
  readBootstrapAdminCredentials,
} from "./dist/bootstrap-admin.mjs";

test("requires valid one-time bootstrap credentials", () => {
  assert.throws(
    () => readBootstrapAdminCredentials({ BOOTSTRAP_ADMIN_PASSWORD: "correct-horse-battery" }),
    /BOOTSTRAP_ADMIN_EMAIL/,
  );
  assert.throws(
    () => readBootstrapAdminCredentials({ BOOTSTRAP_ADMIN_EMAIL: "not-an-email", BOOTSTRAP_ADMIN_PASSWORD: "correct-horse-battery" }),
    /BOOTSTRAP_ADMIN_EMAIL/,
  );
  assert.throws(
    () => readBootstrapAdminCredentials({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com", BOOTSTRAP_ADMIN_PASSWORD: "too-short" }),
    /BOOTSTRAP_ADMIN_PASSWORD/,
  );
});

test("creates a hashed first admin and refuses a second initialization", async () => {
  const storedUsers = [];
  const repository = {
    hasSuperAdmin: async () => storedUsers.length > 0,
    createSuperAdmin: async (user) => { storedUsers.push(user); },
  };
  const credentials = readBootstrapAdminCredentials({
    BOOTSTRAP_ADMIN_EMAIL: " Owner@Example.com ",
    BOOTSTRAP_ADMIN_PASSWORD: "correct-horse-battery",
  });

  assert.equal(await bootstrapFirstSuperAdmin(repository, credentials), "created");
  assert.equal(storedUsers.length, 1);
  assert.equal(storedUsers[0].email, "owner@example.com");
  assert.notEqual(storedUsers[0].passwordHash, credentials.password);
  assert.equal(await bcrypt.compare(credentials.password, storedUsers[0].passwordHash), true);
  assert.equal(await bootstrapFirstSuperAdmin(repository, credentials), "already_initialized");
  assert.equal(storedUsers.length, 1);
});