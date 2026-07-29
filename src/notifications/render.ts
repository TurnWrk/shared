/**
 * Notification template rendering (Change Order 1 R2) — pure, no I/O.
 *
 * Token grammar: {{namespace.key}} — lowercase/digit/underscore segments
 * joined by dots (e.g. {{customer.first_name}}, {{invoice.pay_url}}, {{eta}}).
 * Rendering is all-or-nothing: any unresolved token fails the render, so raw
 * placeholders can never reach a recipient. Callers fall back to the code
 * default template, and if that also fails, skip the send and alert.
 *
 * The same function runs client-side (Settings → Communications live preview)
 * and server-side (the engine), so previews match real sends exactly.
 */

/** Values may be strings or numbers; undefined/null count as missing. */
export type TemplateVars = Record<string, string | number | undefined | null>;

export type TemplateRenderResult =
  | { ok: true; text: string }
  | { ok: false; missing: string[] };

const TOKEN_RE = /\{\{\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*\}\}/g;

/**
 * Dual-read for renamed template variables (Verticals C6 — TURNWRK-325).
 *
 * A trade-neutral template says `{{worker.first_name}}`, but context builders
 * and saved org override docs still speak `{{cleaner.first_name}}`. Resolving
 * through the alias means the rename can land in copy WITHOUT a coordinated
 * deploy of every builder, and an override doc written before the rename keeps
 * rendering instead of failing closed and suppressing the send.
 *
 * Aliases are checked only when the primary key is missing, so a caller that
 * supplies the new name always wins. Remove an entry once every builder and
 * stored override has moved.
 */
export const TEMPLATE_VAR_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'worker.first_name': ['cleaner.first_name'],
});

/** Value for `token`, falling back to its legacy aliases. */
function lookupVar(token: string, vars: TemplateVars): string | number | undefined | null {
  const direct = vars[token];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const alias of TEMPLATE_VAR_ALIASES[token] ?? []) {
    const value = vars[alias];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return direct;
}

/** Render `text`, substituting {{tokens}} from `vars` (dotted keys, flat map). */
export function renderTemplate(text: string, vars: TemplateVars): TemplateRenderResult {
  const missing: string[] = [];
  const out = text.replace(TOKEN_RE, (_m, token: string) => {
    const value = lookupVar(token, vars);
    if (value === undefined || value === null || value === '') {
      if (!missing.includes(token)) missing.push(token);
      return '';
    }
    return String(value);
  });
  return missing.length ? { ok: false, missing } : { ok: true, text: out };
}

/** Distinct tokens referenced by a template (variable chips in the editor UI). */
export function extractTemplateVars(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(TOKEN_RE)) seen.add(match[1]);
  return [...seen];
}
