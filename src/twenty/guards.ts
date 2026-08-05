export type TwentyWebhookAction = 'created' | 'updated' | 'deleted';

export interface TwentyWebhookEvent {
  object: string;
  action: TwentyWebhookAction;
  recordId: string;
  record: Record<string, unknown>;
}

export function isTwentyRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isTwentyListResponse(
  v: unknown,
): v is { data: unknown[] } & Record<string, unknown> {
  if (!isTwentyRecord(v)) return false;
  return Array.isArray(v.data);
}

/**
 * Parse Twenty's `{event, data, timestamp}` webhook payload.
 * Returns null when the shape is not a recognized person/object event.
 */
export function parseTwentyWebhookEvent(v: unknown): TwentyWebhookEvent | null {
  if (!isTwentyRecord(v)) return null;

  const event = v.event;
  if (typeof event !== 'string' || !event.includes('.')) return null;

  const dot = event.lastIndexOf('.');
  const object = event.slice(0, dot);
  const action = event.slice(dot + 1);
  if (
    action !== 'created' &&
    action !== 'updated' &&
    action !== 'deleted'
  ) {
    return null;
  }

  if (!isTwentyRecord(v.data)) return null;

  const recordId = v.data.id;
  if (typeof recordId !== 'string' || !recordId) return null;

  return {
    object,
    action,
    recordId,
    record: v.data,
  };
}
