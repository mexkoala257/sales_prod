/**
 * Platform settings service.
 *
 * Stores arbitrary key-value settings in the `platform_settings` table.
 * Secret values are encrypted at rest using AES-256-GCM with a key derived
 * from SESSION_SECRET.  A 30-second in-memory cache avoids hitting the DB on
 * every request.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";

const ALGORITHM = "aes-256-gcm";
const CACHE_TTL_MS = 30_000;

// ── Encryption ────────────────────────────────────────────────────────────────

function derivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET ?? "dev-key-change-in-production";
  return scryptSync(secret, "platform-settings-v1", 32);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = derivedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ""; // not encrypted / malformed
  const [ivHex, authTagHex, encryptedHex] = parts;
  try {
    const key = derivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CachedEntry {
  value: string;     // plaintext (secrets decrypted in cache)
  isSecret: boolean;
}

let cache: Map<string, CachedEntry> = new Map();
let cacheAt = 0;
let refreshInFlight: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const rows = await db.select().from(platformSettingsTable);
  const next = new Map<string, CachedEntry>();
  for (const row of rows) {
    const value = row.isSecret ? decryptSecret(row.value) : row.value;
    next.set(row.key, { value, isSecret: row.isSecret });
  }
  cache = next;
  cacheAt = Date.now();
}

async function maybeRefresh(): Promise<void> {
  if (Date.now() - cacheAt < CACHE_TTL_MS) return;
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  }
  await refreshInFlight;
}

export function invalidateSettingsCache(): void {
  cacheAt = 0;
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns the setting value from DB-backed cache.
 * Falls back to `fallback` if the key is not set.
 */
export async function getSetting(key: string, fallback?: string): Promise<string | undefined> {
  await maybeRefresh();
  return cache.get(key)?.value ?? fallback;
}

// ── Read all ──────────────────────────────────────────────────────────────────

const MASK = "••••••••";

export interface SettingEntry {
  key: string;
  /** Non-secret: plaintext. Secret with value: MASK. Secret without value: "". */
  value: string;
  isSecret: boolean;
  updatedAt: Date;
}

export async function getAllSettings(): Promise<SettingEntry[]> {
  const rows = await db.select().from(platformSettingsTable);
  return rows.map((row) => ({
    key: row.key,
    value: row.isSecret ? (row.value ? MASK : "") : row.value,
    isSecret: row.isSecret,
    updatedAt: row.updatedAt,
  }));
}

// ── Upsert ────────────────────────────────────────────────────────────────────

export interface UpsertInput {
  key: string;
  value: string;
  isSecret?: boolean;
}

/** Upserts a batch of settings, encrypts secrets, invalidates the cache. */
export async function upsertSettings(inputs: UpsertInput[]): Promise<SettingEntry[]> {
  if (inputs.length === 0) return getAllSettings();

  const now = new Date();
  for (const input of inputs) {
    const storageValue = input.isSecret ? encryptSecret(input.value) : input.value;
    await db
      .insert(platformSettingsTable)
      .values({
        key: input.key,
        value: storageValue,
        isSecret: input.isSecret ?? false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value: storageValue, isSecret: input.isSecret ?? false, updatedAt: now },
      });
  }

  invalidateSettingsCache();
  return getAllSettings();
}
