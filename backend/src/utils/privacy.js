// backend/src/utils/privacy.js
//
// Phone numbers are the one piece of PII this system handles at scale, so
// they should never sit in plaintext in the database. Two different needs
// are in tension here:
//   1. We need to LOOK UP records by phone number (e.g. "has this number
//      been reported before?") — this needs a deterministic, matchable key.
//   2. NGO/platform staff need to SEE the actual number to act on it (a
//      one-way hash can never be reversed back to a real number).
//
// The standard real-world pattern for this: store a deterministic HMAC
// hash as the lookup key, and store the actual number separately,
// encrypted (reversible only with a server-side key) — so a raw database
// leak exposes neither the plaintext number nor anything hash-guessable
// without also compromising the encryption key.

const crypto = require("crypto");

const HASH_SECRET = process.env.PHONE_HASH_SECRET || "dev-only-insecure-hash-secret-change-me";
const ENCRYPTION_KEY_RAW = process.env.PHONE_ENCRYPTION_KEY || "dev-only-insecure-32-char-key!!";

// AES-256-GCM needs exactly a 32-byte key — derive one from whatever
// string is provided so a short/long .env value doesn't crash at startup.
const ENCRYPTION_KEY = crypto.createHash("sha256").update(ENCRYPTION_KEY_RAW).digest();

/** Deterministic, one-way — safe to use as a lookup key, never reversible. */
function hashPhoneNumber(phoneNumber) {
  return crypto.createHmac("sha256", HASH_SECRET).update(phoneNumber).digest("hex");
}

/** Reversible (with the server's key) — for storing the actual number safely at rest. */
function encryptPhoneNumber(phoneNumber) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(phoneNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack iv + authTag + ciphertext into one base64 string for easy storage.
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decryptPhoneNumber(blob) {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

module.exports = { hashPhoneNumber, encryptPhoneNumber, decryptPhoneNumber };
