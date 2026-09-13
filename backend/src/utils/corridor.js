// backend/src/utils/corridor.js
//
// "Corridor" in this product's language = the migration corridor a check
// belongs to, identified by the ORIGIN country of the phone number being
// checked (its E.164 calling code) — e.g. a worker checking a number
// while holding a +92 (Pakistan) SIM is "the Pakistan -> Gulf corridor".
// We don't have a separate "destination country" field anywhere (workers
// aren't asked which country they're traveling to), so corridor tracking
// here means origin-country breakdown — real and derivable from data we
// already have, not a fabricated multi-country pipeline.
//
// Calling codes are matched longest-prefix-first (e.g. "971" before "97")
// so multi-digit codes that share a leading digit with a shorter code
// don't get misclassified.

const DIAL_CODES = [
  // Common South/Southeast Asian and African labor-migration source
  // countries for this corridor, plus the Gulf/MENA destination countries
  // this product's recruiter side operates in. Extend as needed — unknown
  // codes fall back to "Other" rather than guessing.
  ["93", "Afghanistan"],
  ["880", "Bangladesh"],
  ["855", "Cambodia"],
  ["251", "Ethiopia"],
  ["91", "India"],
  ["62", "Indonesia"],
  ["254", "Kenya"],
  ["961", "Lebanon"],
  ["218", "Libya"],
  ["977", "Nepal"],
  ["92", "Pakistan"],
  ["63", "Philippines"],
  ["94", "Sri Lanka"],
  ["255", "Tanzania"],
  ["256", "Uganda"],
  ["84", "Vietnam"],
  ["973", "Bahrain"],
  ["965", "Kuwait"],
  ["968", "Oman"],
  ["974", "Qatar"],
  ["966", "Saudi Arabia"],
  ["971", "United Arab Emirates"],
  ["1", "US/Canada"],
  ["44", "United Kingdom"],
].sort((a, b) => b[0].length - a[0].length); // longest code first

/** Resolves an E.164-ish phone number ("+971501234567") to a corridor/country label. */
function resolveCorridor(phoneNumber) {
  if (!phoneNumber) return "Unknown";
  const digits = String(phoneNumber).replace(/^\+/, "").replace(/\D/g, "");
  const match = DIAL_CODES.find(([code]) => digits.startsWith(code));
  return match ? match[1] : "Other";
}

module.exports = { resolveCorridor };
