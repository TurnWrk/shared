/**
 * A guest phone bound to a property for the guest SMS channel (TURNWRK-742).
 *
 * Bookings store no guest phone, so a guest binds by texting the property's
 * guest code (`PropertyShareToken.smsCode`) to the Turnwrk number. Guest-
 * initiated, which is the consent. Until `expireAt`, every text from the phone
 * becomes a `guest_sms` inbox item for the property.
 *
 * Collection `cmms_guestContacts`, doc id = E.164 phone, Admin SDK only. The
 * same doc carries the phone's bind-attempt window so a number guessing codes
 * is throttled whether or not it ever bound.
 */
export interface GuestContact {
  phoneE164: string;

  // --- the binding (absent until a code matched) ---
  orgId?: string;
  propertyId?: string;
  /** The guest share token whose `smsCode` was texted. */
  tokenId?: string;
  /** The code as stored on the token, uppercase. */
  code?: string;
  /** The stay matched at bind time, when there was one. */
  bookingId?: string;
  /** Epoch ms. */
  boundAt?: number;
  /**
   * Epoch ms the binding stops routing texts: the matched booking's checkout
   * (org-local date at the property's check-out time), or bind time + 24h
   * when no stay matched.
   */
  expireAt?: number;
  /** Epoch ms the guest texted STOP; ends the binding until they re-bind. */
  optedOutAt?: number;

  // --- bind-attempt throttle (fixed window) ---
  /** Epoch ms the current attempt window opened. */
  bindWindowStart?: number;
  /** Code-shaped texts that did not bind, in the current window. */
  bindAttempts?: number;
}

/** True when the doc routes texts to a property at `now`. */
export function isGuestContactActive(
  contact: Partial<GuestContact> | null | undefined,
  now: number,
): contact is GuestContact & { orgId: string; propertyId: string; expireAt: number } {
  return (
    !!contact &&
    typeof contact.orgId === 'string' &&
    typeof contact.propertyId === 'string' &&
    typeof contact.expireAt === 'number' &&
    contact.expireAt > now &&
    contact.optedOutAt === undefined
  );
}
