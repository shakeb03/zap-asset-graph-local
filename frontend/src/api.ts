import type { Asset, AssetsResponse, BlastRadiusResponse, HealthReportResponse } from './types';

const API = '/api';

const UNREACHABLE_MESSAGE =
  'API is unreachable. Make sure the backend is running (e.g. npm run dev:backend).';

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && (e.message === 'Failed to fetch' || e.message.includes('fetch')))
    return true;
  if (e instanceof Error && e.name === 'TypeError') return true;
  return false;
}

export function getFriendlyErrorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (isNetworkError(e)) return UNREACHABLE_MESSAGE;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

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

export async function askAssistant(message: string, context: unknown): Promise<{ text: string }> {
  const res = await fetch(`${API}/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string; details?: string }).details ?? (err as { error?: string }).error ?? 'Assistant unavailable');
  }
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
