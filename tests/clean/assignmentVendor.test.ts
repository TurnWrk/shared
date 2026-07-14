import { describe, it, expect } from 'vitest';
import {
  resolveAssignmentVendorId,
  legacyAssignmentVendorPatch,
} from '../../src/clean/assignmentVendor';

describe('resolveAssignmentVendorId dual-read', () => {
  it('prefers assignment.vendorId on new docs', () => {
    expect(
      resolveAssignmentVendorId({
        assignment: { vendorId: 'vend_a' },
        tech: { vendorId: 'vend_b' },
      }),
    ).toBe('vend_a');
  });

  it('falls back to tech.vendorId when assignment stamp missing (old doc)', () => {
    expect(
      resolveAssignmentVendorId({
        assignment: {},
        tech: { vendorId: 'vend_tech' },
      }),
    ).toBe('vend_tech');
  });

  it('returns undefined when neither has a vendor link', () => {
    expect(resolveAssignmentVendorId({ assignment: {}, tech: {} })).toBeUndefined();
  });
});

describe('legacyAssignmentVendorPatch', () => {
  it('stamps from tech when assignment missing vendorId', () => {
    expect(legacyAssignmentVendorPatch({}, { vendorId: 'vend_x' })).toEqual({
      vendorId: 'vend_x',
    });
  });

  it('skips when already stamped unless force', () => {
    expect(legacyAssignmentVendorPatch({ vendorId: 'vend_a' }, { vendorId: 'vend_b' })).toBeNull();
    expect(
      legacyAssignmentVendorPatch({ vendorId: 'vend_a' }, { vendorId: 'vend_b' }, { force: true }),
    ).toEqual({ vendorId: 'vend_a' });
  });

  it('returns null when tech has no vendorId', () => {
    expect(legacyAssignmentVendorPatch({})).toBeNull();
  });
});
