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
}
