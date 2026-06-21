export interface WhisperTranscribeResult {
  transcript: string;
  model: string;
  language: string;
  clientId: string;
  durationMs: number;
}

export interface WhisperClientConfig {
  /** Base URL without trailing slash, e.g. https://whisper.turnwrk.com */
  baseUrl: string;
  /** Bearer token issued for this client in WHISPER_CLIENT_TOKENS */
  token: string;
  /** Optional client id sent as X-Turnwrk-Client (recommended for multi-tenant auth) */
  clientId?: string;
  /** Request timeout in ms (default 300000) */
  timeoutMs?: number;
}

export interface WhisperTranscribeOptions {
  model?: string;
  language?: string;
}

export type WhisperClientErrorCode =
  | 'WHISPER_UNAVAILABLE'
  | 'WHISPER_TIMEOUT'
  | 'WHISPER_UNAUTHORIZED'
  | 'WHISPER_FAILED'
  | 'WHISPER_NOT_CONFIGURED';

export class WhisperClientError extends Error {
  readonly name = 'WhisperClientError';

  constructor(
    message: string,
    readonly code: WhisperClientErrorCode,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
