import type { Asset, AssetsResponse, BlastRadiusResponse, HealthReportResponse } from './types';

const API = '/api';

export async function fetchAssets(params?: {
  type?: string;
  workspace?: string;
  status?: string;
  search?: string;
}): Promise<AssetsResponse> {
  const search = new URLSearchParams();
  if (params?.type) search.set('type', params.type);
  if (params?.workspace) search.set('workspace', params.workspace);
  if (params?.status) search.set('status', params.status);
  if (params?.search) search.set('search', params.search);
  const q = search.toString();
  const res = await fetch(`${API}/assets${q ? `?${q}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch assets');
  return res.json();
}

export async function fetchBlastRadius(assetId: string): Promise<BlastRadiusResponse> {
  const res = await fetch(`${API}/assets/${assetId}/blast-radius`);
  if (!res.ok) throw new Error('Failed to fetch blast radius');
  return res.json();
}

export async function fetchHealthReport(): Promise<HealthReportResponse> {
  const res = await fetch(`${API}/health/report`);
  if (!res.ok) throw new Error('Failed to fetch health report');
  return res.json();
}

export async function transferOwnership(
  assetId: string,
  body: { newOwner: string; actor: string }
): Promise<Asset> {
  const res = await fetch(`${API}/assets/${assetId}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to transfer ownership');
  return res.json();
}
