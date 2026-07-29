/**
 * @deprecated Verticals C2 (TURNWRK-321) — catalog + pricing moved to
 * `@turnwrk/shared/service`. Re-exported for one release.
 */
export * from '../service';
/**
 * @deprecated Verticals C4 (TURNWRK-323) — booking/series/availability moved to
 * `@turnwrk/shared/booking`. Re-exported for one release.
 */
export * from '../booking';
export * from './orgTime';
export * from './payments';
export * from './invoiceKind';
export * from './paymentPolicy';
export * from './assignmentVendor';

export * from './availability';
/**
 * @deprecated Verticals C6 (TURNWRK-325) — notifications moved to
 * `@turnwrk/shared/notifications`. Re-exported for one release.
 */
export * from '../notifications';
/**
 * @deprecated Verticals C1 (TURNWRK-319) — the visit report moved to
 * `@turnwrk/shared/proof`. Re-exported for one release so vendored copies and
 * app imports keep compiling.
 */
export * from '../proof';
export * from './bountyDraw';
export * from './bountySubmission';
export * from './bountyDefaults';
export * from './geo';
export * from './imageHash';
export * from './payoutPeriods';
