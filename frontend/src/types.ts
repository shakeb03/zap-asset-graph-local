export type AssetType = 'zap' | 'connection';
export type AssetStatus = 'active' | 'paused' | 'disabled';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  owner: string | null;
  workspace: string;
  zapierZapId: string | null;
  zapierEditUrl: string | null;
  triggerApp: string | null;
  actionApps: string | null;
  createdAt: string;
  updatedAt: string;
  dependenciesAsDependent?: Array<{ dependentId: string; dependencyId: string; dependency: Asset }>;
  dependenciesAsDependency?: Array<{ dependentId: string; dependencyId: string; dependent: Asset }>;
}

export interface AssetsResponse {
  data: Asset[];
  stats: { byType: Record<string, number>; byStatus: Record<string, number>; total: number };
}

export interface BlastRadiusResponse {
  root: Asset;
  impactedAssets: Asset[];
  impactEdges: Array< { from: string; to: string; relationshipType: string }>;
  totalImpacted: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  message: string;
}

export interface HealthReportResponse {
  orphaned: { count: number; assets: Asset[] };
  errorOrPaused: { count: number; assets: Asset[] };
  circularDependencies: { detected: boolean; cycles: string[][] };
  singlePointsOfFailure: { count: number; assets: Array<Asset & { dependentCount?: number }> };
  perWorkspace: Array<{ workspace: string; assetCount: number }>;
  healthScore: number;
  deductions: string[];
}
