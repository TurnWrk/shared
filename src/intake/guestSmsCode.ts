/**
 * Guest SMS codes (TURNWRK-742): the short code printed with a property's guest
 * QR ("text K7P4QM to …"). Dispatch mints one per guest share token; cortex
 * finds it in an unknown number's text and binds that phone to the property.
 *
 * Shape: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L),
 * always mixing at least one letter and one digit. The mix is what lets cortex
 * pick a code out of free text: an ordinary word ("TOILET", "PLEASE") never
 * has a digit, and a number ("123456") never has a letter, so neither counts
 * as a bind attempt.
 *
 * About 7.4e8 valid codes. Uniqueness is probabilistic (a client cannot query
 * other orgs' tokens); cortex treats a code matching more than one active token
 * as no match, and binding attempts are throttled per phone.
 */

export const GUEST_SMS_CODE_LENGTH = 6;
export const GUEST_SMS_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const DIGIT = /[0-9]/;
const LETTER = /[A-Z]/;
const CODE_SHAPE = new RegExp(`^[${GUEST_SMS_CODE_ALPHABET}]{${GUEST_SMS_CODE_LENGTH}}$`);
/** Cap on candidates per message: bounds the lookup (Firestore `in` takes 30). */
export const MAX_GUEST_SMS_CODE_CANDIDATES = 10;

export function isGuestSmsCode(value: string): boolean {
  return CODE_SHAPE.test(value) && DIGIT.test(value) && LETTER.test(value);
}

type RandomBytes = (n: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (n) => {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/** A fresh code. Rejection-sampled, so every alphabet character is equally likely. */
export function generateGuestSmsCode(randomBytes: RandomBytes = defaultRandomBytes): string {
  const n = GUEST_SMS_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  for (;;) {
    let code = '';
    while (code.length < GUEST_SMS_CODE_LENGTH) {
      for (const b of randomBytes(GUEST_SMS_CODE_LENGTH * 2)) {
        if (b >= limit) continue;
        code += GUEST_SMS_CODE_ALPHABET[b % n];
        if (code.length === GUEST_SMS_CODE_LENGTH) break;
      }
    }
    if (isGuestSmsCode(code)) return code;
  }
}

/**
 * Every code-shaped word in a text, uppercased, deduped, in order. Case-
 * insensitive and tolerant of anything around it: "hi k7p4qm, the sink is
 * leaking" yields `['K7P4QM']`.
 */
export function findGuestSmsCodeCandidates(body: string): string[] {
  const out: string[] = [];
  for (const word of body.toUpperCase().split(/[^A-Z0-9]+/)) {
    if (!isGuestSmsCode(word) || out.includes(word)) continue;
    out.push(word);
    if (out.length === MAX_GUEST_SMS_CODE_CANDIDATES) break;
  }
  return out;
}

/** The text with `code` removed (any case), whitespace collapsed. */
export function stripGuestSmsCode(body: string, code: string): string {
  return body
    .replace(new RegExp(`(^|[^A-Za-z0-9])${code}(?=$|[^A-Za-z0-9])`, 'gi'), '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;!-]+/, '')
    .trim();
}
