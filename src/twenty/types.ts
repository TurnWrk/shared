/** Owner identity fields extracted from or sent to Twenty CRM. */
export interface TwentyOwnerFields {
  name: string;
  phone: string;
  email?: string;
}

/** Per-org dot-path mapping from Twenty composite fields to owner fields. */
export interface TwentyFieldMap {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export type TwentyClientErrorCode =
  | 'TWENTY_AUTH'
  | 'TWENTY_RATE_LIMIT'
  | 'TWENTY_NOT_FOUND'
  | 'TWENTY_BAD_RESPONSE'
  | 'TWENTY_TIMEOUT'
  | 'TWENTY_UNAVAILABLE';

export class TwentyClientError extends Error {
  readonly name = 'TwentyClientError';

  constructor(
    message: string,
    readonly code: TwentyClientErrorCode,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
