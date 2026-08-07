/**
 * Public vendor calendar share links.
 *
 * A share token is an evergreen, revocable bearer secret for one property:
 * the public occupancy-calendar page (served by dispatch at
 * `/calendar/{tokenId}`) resolves it server-side via the Admin SDK. Tokens
 * are created/revoked from both the hostfix dispatch UI and restock's
 * property detail page, hence the unprefixed shared collection
 * (`propertyShareTokens`). One active token per property; regenerating
 * deactivates the previous one so old links die immediately.
 */
export interface PropertyShareToken {
  /** 64-char hex doc id (crypto-random 32 bytes) — the bearer secret. */
  id: string;
  propertyId: string;
  orgId: string;
  /** Epoch ms. */
  createdAt: number;
  /** Auth uid of the creator; audit only. */
  createdBy?: string;
  isActive: boolean;
  /** Epoch ms; unset in v1 (evergreen) but validated when present. */
  expiresAt?: number;
  /**
   * Token-level kill switch for share-guest chat (TURNWRK-416/417).
   * Absent or true = chat allowed; explicit false cuts guest R/W.
   */
  chatEnabled?: boolean;
}

/**
 * Guest identity for the public `/share/[token]/chat` surface (TURNWRK-416).
 * Admin-SDK-only collection — the signed httpOnly cookie is the client credential.
 */
export interface PropertyShareGuest {
  id: string;
  tokenId: string;
  propertyId: string;
  orgId: string;
  /** Display name the guest typed once. */
  displayName: string;
  /** Epoch ms. */
  createdAt: number;
  /** Soft-kill when the share token is regenerated. */
  revokedAt?: number;
}
