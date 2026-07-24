import { describe, expect, it } from 'vitest';
import {
  restockScanEventDocId,
  restockScanResupplyDocId,
  sanitizeScanIdPart,
} from '../src/types/resupply';

describe('restock scan event ids (TURNWRK-252)', () => {
  it('sanitizes id parts', () => {
    expect(sanitizeScanIdPart(' abc-123_XYZ ')).toBe('abc-123_XYZ');
    expect(sanitizeScanIdPart('bad/../chars!')).toBe('badchars');
    expect(sanitizeScanIdPart('')).toBe('');
  });

  it('builds stable paired doc ids', () => {
    expect(restockScanEventDocId('tok1', 'scan-a')).toBe('scan_tok1_scan-a');
    expect(restockScanResupplyDocId('tok1', 'scan-a')).toBe('rr_scan_tok1_scan-a');
  });

  it('returns null when either part is empty after sanitize', () => {
    expect(restockScanEventDocId('', 'x')).toBeNull();
    expect(restockScanResupplyDocId('tok', '!!!')).toBeNull();
  });
});
