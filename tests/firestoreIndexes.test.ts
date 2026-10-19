import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Composite indexes that consumer queries depend on. The Firestore emulator
 * serves every query without composite indexes, so no emulator test can catch
 * a missing one: prod answers FAILED_PRECONDITION instead (TURNWRK-775, where
 * cortex's trade-reminder-sweep failed every run for 10+ days). Add a row here
 * with each new compound query (equality + range/orderBy on another field).
 */
const REQUIRED: Array<{ collectionGroup: string; fields: Array<[string, 'ASCENDING' | 'DESCENDING']>; usedBy: string }> = [
  {
    collectionGroup: 'cmms_workOrders',
    fields: [['status', 'ASCENDING'], ['scheduledDate', 'ASCENDING']],
    usedBy: 'turnwrk-cortex src/services/tradeReminderSweep.ts',
  },
  {
    collectionGroup: 'cmms_workOrders',
    fields: [['assignedTechId', 'ASCENDING'], ['createdAt', 'DESCENDING']],
    usedBy: 'turnwrk-cortex src/services/smsPhoneResolver.ts + telegramUserResolver.ts',
  },
  {
    collectionGroup: 'resupplyRequests',
    fields: [['cleanerId', 'ASCENDING'], ['createdAt', 'DESCENDING']],
    usedBy: 'turnwrk-cortex src/services/smsPhoneResolver.ts + telegramUserResolver.ts',
  },
];

interface IndexDef {
  collectionGroup: string;
  queryScope: string;
  fields: Array<{ fieldPath: string; order?: string }>;
}

const indexes: IndexDef[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '../firebase/firestore.indexes.json'), 'utf8'),
).indexes;

describe('firestore.indexes.json', () => {
  for (const req of REQUIRED) {
    const shape = req.fields.map(([f, o]) => `${f} ${o}`).join(', ');
    it(`declares ${req.collectionGroup} (${shape}) for ${req.usedBy}`, () => {
      const match = indexes.find(
        (ix) =>
          ix.collectionGroup === req.collectionGroup
          && ix.queryScope === 'COLLECTION'
          && ix.fields.length === req.fields.length
          && ix.fields.every((f, i) => f.fieldPath === req.fields[i][0] && f.order === req.fields[i][1]),
      );
      expect(match).toBeDefined();
    });
  }
});
