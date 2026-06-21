import type {
  WhisperClientConfig,
  WhisperTranscribeOptions,
  WhisperTranscribeResult,
} from './types';
import { WhisperClientError } from './types';
import { mimeTypeForAudioExtension, sniffAudioExtension } from './sniffAudio';

const DEFAULT_TIMEOUT_MS = 300_000;

export interface WhisperClient {
  transcribe(
    audio: Buffer | Uint8Array,
    options?: WhisperTranscribeOptions,
  ): Promise<WhisperTranscribeResult>;
}

export function createWhisperClient(config: WhisperClientConfig): WhisperClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async transcribe(audio, options = {}) {
      if (!audio || audio.length === 0) {
        throw new WhisperClientError('Empty audio buffer', 'WHISPER_FAILED');
      }

      const params = new URLSearchParams();
      if (options.model) params.set('model', options.model);
      if (options.language) params.set('language', options.language);
      const query = params.toString();
      const url = `${baseUrl}/v1/transcribe${query ? `?${query}` : ''}`;

      const ext = sniffAudioExtension(audio);
      const form = new FormData();
      const blob = new Blob([Uint8Array.from(audio)], {
        type: mimeTypeForAudioExtension(ext),
      });
      form.append('audio', blob, `audio.${ext}`);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.token}`,
      };
      if (config.clientId) {
        headers['X-Turnwrk-Client'] = config.clientId;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: form,
          signal: controller.signal,
        });

        const text = await response.text();
        let payload: Partial<WhisperTranscribeResult> & { detail?: string; error?: string } = {};
        try {
          payload = text ? JSON.parse(text) as typeof payload : {};
        } catch {
          payload = { detail: text };
        }

        if (!response.ok) {
          const detail = payload.detail || payload.error || text.slice(0, 800);
          if (response.status === 401) {
            throw new WhisperClientError(detail || 'Unauthorized', 'WHISPER_UNAUTHORIZED', 401);
          }
          if (response.status === 504) {
            throw new WhisperClientError(detail || 'Whisper timed out', 'WHISPER_TIMEOUT', 504);
          }
          if (response.status === 503) {
            throw new WhisperClientError(detail || 'Whisper unavailable', 'WHISPER_UNAVAILABLE', 503);
          }
          throw new WhisperClientError(
            detail || `Whisper error (${response.status})`,
            'WHISPER_FAILED',
            response.status,
          );
        }

        return {
          transcript: (payload.transcript || '').trim(),
          model: payload.model || options.model || 'base',
          language: payload.language || options.language || 'en',
          clientId: payload.clientId || config.clientId || 'unknown',
          durationMs: payload.durationMs ?? 0,
        };
      } catch (error) {
        if (error instanceof WhisperClientError) {
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          throw new WhisperClientError('Whisper request timed out', 'WHISPER_TIMEOUT', undefined, error);
        }
        throw new WhisperClientError(
          `Whisper request failed: ${error instanceof Error ? error.message : String(error)}`,
          'WHISPER_FAILED',
          undefined,
          error,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** One-shot helper when you do not need a reusable client instance. */
export async function transcribeAudio(
  audio: Buffer | Uint8Array,
  config: WhisperClientConfig,
  options?: WhisperTranscribeOptions,
): Promise<WhisperTranscribeResult> {
  return createWhisperClient(config).transcribe(audio, options);
}

/** Build config from standard Turnwrk env vars (server-side). */
export function whisperClientConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WhisperClientConfig | undefined {
  const baseUrl = env.WHISPER_SERVICE_URL?.trim();
  const token = env.WHISPER_API_TOKEN?.trim() || env.API_TOKEN?.trim();
  if (!baseUrl || !token) {
    return undefined;
  }
  return {
    baseUrl,
    token,
    clientId: env.WHISPER_CLIENT_ID?.trim() || undefined,
    timeoutMs: env.WHISPER_TIMEOUT_MS ? Number(env.WHISPER_TIMEOUT_MS) : undefined,
  };
}
