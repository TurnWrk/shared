import type { InspectMode } from './property';

export interface OrgBranding {
  logoUrl?: string;
  logoPath?: string;
  accentColor?: string;
}

export interface Org {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  // which apps this org has enabled — lets apps gate features without
  // requiring a separate config lookup
  enabledApps?: {
    hostfixCmms?: boolean;
    restock?: boolean;
  };
  branding?: OrgBranding;
  /**
   * Default inspect mode applied to newly created properties for this org.
   * Individual properties can still override via `PropertySupply.inspectMode`.
   * Falls back to `'full_checklist'` when absent.
   */
  defaultInspectMode?: InspectMode;
  /**
   * Vendor "quick work order" thresholds. When a vendor raises a small work
   * order on-site that falls under either cap (or is an emergency) it skips the
   * dispatcher approval gate. Absent fields fall back to app-level defaults
   * (see hostfix-cmms/lib/quickWorkOrder.ts DEFAULT_QUICK_WO_CONFIG).
   */
  quickWorkOrder?: {
    enabled?: boolean;       // default true
    maxLaborHours?: number;  // default 2
    maxCostUsd?: number;     // default 200
  };
}
