import * as crypto from "node:crypto";
import { promisify } from "node:util";

// DOSSIER_PASSWORD holds an argon2id hash of the sign-in password, never the
// password itself, so reading the environment doesn't reveal it. The hash is
// written as
//
//   argon2id:m=<memory in KiB>,t=<passes>,p=<lanes>:<salt>:<hash>
//
// with the salt and hash in base64url. Unlike the usual $argon2id$v=19$… form
// it has no "$", because Next.js and Docker Compose expand "$" in .env files,
// even inside quotes. No "server-only": scripts/hash-password.ts uses it too.

type Argon2Fn = (algorithm: string, options: unknown, callback: (err: Error | null, res: Buffer) => void) => void;
const nodeArgon2 = (crypto as unknown as { argon2?: Argon2Fn }).argon2;
const derive = nodeArgon2 ? (promisify(nodeArgon2) as (algorithm: string, options: unknown) => Promise<Buffer>) : null;

/** OWASP's recommended argon2id settings: 19 MiB of memory, 2 passes, 1 lane. */
const DEFAULTS = { memory: 19_456, passes: 2, parallelism: 1 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;
/** More memory than this per sign-in would crowd out Chromium in a 1 GB container. */
const MAX_MEMORY = 262_144;

const FORMAT = /^argon2id:m=(\d{1,7}),t=(\d{1,3}),p=(\d{1,3}):([\w-]{22,}):([\w-]{43,})$/;

type PasswordHash = {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
};

/** Reads a hash written by hashPassword(); null when `value` isn't one. */
export function parsePasswordHash(value: string): PasswordHash | null {
  const match = FORMAT.exec(value);
  if (!match) return null;
  const [memory, passes, parallelism] = match.slice(1, 4).map(Number);
  if (passes < 1 || parallelism < 1 || memory < 8 * parallelism || memory > MAX_MEMORY) return null;
  return {
    memory,
    passes,
    parallelism,
    salt: Buffer.from(match[4], "base64url"),
    hash: Buffer.from(match[5], "base64url"),
  };
}

/** Whether `value` is a password hash rather than a password. */
export function isPasswordHash(value: string): boolean {
  return parsePasswordHash(value) !== null;
}

async function compute(password: string, { memory, passes, parallelism, salt }: Omit<PasswordHash, "hash">, length: number): Promise<Buffer> {
  if (derive) {
    return derive("argon2id", { message: password, nonce: salt, memory, passes, parallelism, tagLength: length }) as Promise<Buffer>;
  }
  const { argon2id } = await import("hash-wasm");
  const result = await argon2id({
    password,
    salt: new Uint8Array(salt),
    parallelism,
    iterations: passes,
    memorySize: memory,
    hashLength: length,
    outputType: "binary",
  });
  return Buffer.from(result);
}

/** Hashes `password` with a fresh random salt, for DOSSIER_PASSWORD. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await compute(password, { ...DEFAULTS, salt }, HASH_BYTES);
  const { memory, passes, parallelism } = DEFAULTS;
  return `argon2id:m=${memory},t=${passes},p=${parallelism}:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

/** Whether `candidate` is the password that `stored` is a hash of. */
export async function verifyPassword(candidate: string, stored: string): Promise<boolean> {
  if (!candidate) return false;
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const hash = await compute(candidate, parsed, parsed.hash.length);
  return crypto.timingSafeEqual(hash, parsed.hash);
}
