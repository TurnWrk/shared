/**
 * Who a share token is for (TURNWRK-741).
 *
 * - `vendor` — the `/share/[token]` surface (occupancy calendar, WiFi, chat).
 *   Every token minted before the field existed is a vendor token.
 * - `guest` — the guest report page `/r/[token]` behind a per-property QR. It
 *   shows the property nickname only and never resolves on a vendor surface.
 *
 * One active token per property PER AUDIENCE: regenerating a vendor link must
 * not kill the QR taped inside the house, and vice versa.
 */
export type ShareTokenAudience = 'vendor' | 'guest';

export const SHARE_TOKEN_AUDIENCES: readonly ShareTokenAudience[] = ['vendor', 'guest'];

/**
 * Read a token's audience. Absent (every pre-741 doc) or unknown values read
 * as `vendor`, so a legacy link keeps resolving exactly as it did; only an
 * explicit `'guest'` opens the guest surface.
 */
export function shareTokenAudience(token: { audience?: unknown }): ShareTokenAudience {
  return token.audience === 'guest' ? 'guest' : 'vendor';
}

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
  /** Absent = `vendor` (legacy). Read through `shareTokenAudience`. */
  audience?: ShareTokenAudience;
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
