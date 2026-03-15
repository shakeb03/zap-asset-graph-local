import { useState } from 'react';
import { X, ExternalLink, ArrowRight } from 'lucide-react';
import type { Asset } from '../types';
import type { BlastRadiusResponse } from '../types';
import { transferOwnership, getFriendlyErrorMessage } from '../api';

interface AssetSidebarProps {
  asset: Asset;
  blastRadius: BlastRadiusResponse | null;
  blastRadiusLoading?: boolean;
  onClose: () => void;
  onAssetUpdated?: (asset: Asset) => void;
  onSelectAsset?: (id: string) => void;
}

const SEVERITY_RING: Record<string, { ring: string; glow: string }> = {
  none: { ring: 'ring-2 ring-emerald-500/60', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' },
  low: { ring: 'ring-2 ring-blue-500/60', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.4)]' },
  medium: { ring: 'ring-2 ring-amber-500/60', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]' },
  high: { ring: 'ring-2 ring-red-500/60', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' },
};

function BlastRadiusDiagram({
  rootAsset,
  impactedAssets,
  onSelectAsset,
}: {
  rootAsset: Asset;
  impactedAssets: Asset[];
  severity: BlastRadiusResponse['severity'];
  onSelectAsset?: (id: string) => void;
}) {
  const rows = Math.max(1, Math.ceil(impactedAssets.length / 2));
  const diagramHeight = 40 + rows * 40;
  const viewBoxHeight = 40 + rows * 40;

  return (
    <div className="mt-2">
      {/* Center node (selected asset) at top */}
      <div className="flex justify-center">
        <div
          className={`
            inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-medium
            ${rootAsset.type === 'zap' ? 'bg-[#ff6b35]/20 text-[#ff6b35] border border-[#ff6b35]/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}
          `}
          title={rootAsset.name}
        >
          <span className="truncate">{rootAsset.name}</span>
        </div>
      </div>

      {/* Lines fanning out + impacted pills */}
      <div
        className="relative w-full"
        style={{ height: diagramHeight }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${viewBoxHeight}`}
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
        >
          {impactedAssets.map((_, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 25 + 50 * col;
            const y = 40 + 40 * row;
            const delayClass = `blast-line-delay-${Math.min(i + 1, 8)}`;
            return (
              <line
                key={i}
                x1={50}
                y1={0}
                x2={x}
                y2={y}
                className={`blast-line ${delayClass}`}
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-0 grid pt-10"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: `repeat(${rows}, 40px)`,
          }}
        >
          {impactedAssets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectAsset?.(a.id)}
              className={`
                flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-medium
                truncate transition-opacity hover:opacity-90
                ${a.type === 'zap' ? 'bg-[#ff6b35]/25 text-[#ff6b35] border border-[#ff6b35]/50' : 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/50'}
              `}
              title={a.name}
            >
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseActionApps(actionApps: string | null): string[] {
  if (!actionApps) return [];
  try {
    const parsed = JSON.parse(actionApps) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function ZapFlow({ triggerApp, actionApps }: { triggerApp: string | null; actionApps: string | null }) {
  const actions = parseActionApps(actionApps);
  const parts = [triggerApp ?? '—', ...actions].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-300">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="size-3.5 shrink-0 text-zinc-500" />}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}

export function AssetSidebar({ asset, blastRadius, blastRadiusLoading, onClose, onAssetUpdated, onSelectAsset }: AssetSidebarProps) {
  const [newOwner, setNewOwner] = useState('');
  const [actor, setActor] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!newOwner.trim() || !actor.trim()) return;
    setTransferLoading(true);
    setTransferError(null);
    try {
      const updated = await transferOwnership(asset.id, {
        newOwner: newOwner.trim(),
        actor: actor.trim(),
      });
      onAssetUpdated?.(updated);
      setNewOwner('');
      setActor('');
    } catch (e) {
      setTransferError(getFriendlyErrorMessage(e, 'Transfer failed'));
    } finally {
      setTransferLoading(false);
    }
  };

  const dependencies = asset.dependenciesAsDependent ?? [];
  const severity = blastRadius?.severity ?? 'none';
  const severityRing = SEVERITY_RING[severity] ?? SEVERITY_RING.none;
  const isHighSeverity = severity === 'high';

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-[#2a2a3a] bg-[#12121a]">
      <div className="flex items-center justify-between border-b border-[#2a2a3a] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Asset details</h2>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-[#2a2a3a] hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-medium text-white">{asset.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <span className="rounded bg-[#2a2a3a] px-2 py-0.5 text-xs font-medium capitalize text-zinc-300">
                {asset.type}
              </span>
              <span className="rounded border border-[#2a2a3a] px-2 py-0.5 text-xs font-medium capitalize text-zinc-400">
                {asset.status}
              </span>
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="text-zinc-500">Owner</dt>
                <dd className="text-zinc-300">{asset.owner ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Workspace</dt>
                <dd className="text-zinc-300">{asset.workspace}</dd>
              </div>
            </dl>
          </div>

          {asset.type === 'zap' && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Flow</h4>
              <div className="mt-1 rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2">
                <ZapFlow triggerApp={asset.triggerApp} actionApps={asset.actionApps} />
              </div>
            </div>
          )}

          {asset.type === 'zap' && asset.zapierEditUrl && (
            <div>
              <a
                href={asset.zapierEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm font-medium text-[#ff6b35] transition-colors hover:border-[#ff6b35] hover:bg-[#2a2a3a]"
              >
                <ExternalLink size={14} />
                View in Zapier
              </a>
            </div>
          )}

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Blast radius
            </h4>
            {blastRadiusLoading ? (
              <div className="mt-1.5 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-16 animate-pulse rounded bg-[#2a2a3a]" />
                  <div className="h-5 w-14 animate-pulse rounded bg-[#2a2a3a]" />
                </div>
                <div className="h-20 animate-pulse rounded-md border border-[#2a2a3a] bg-[#0a0a0f]" />
              </div>
            ) : blastRadius ? (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`
                      inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2.5 text-sm font-semibold text-zinc-200
                      ${severityRing.ring} ${severityRing.glow}
                      ${isHighSeverity ? 'severity-count-pulse' : ''}
                    `}
                    title={`Severity: ${severity}`}
                  >
                    {blastRadius.totalImpacted}
                  </span>
                  <span className="text-xs text-zinc-500">
                    impacted · <span className="capitalize text-zinc-400">{severity}</span>
                  </span>
                </div>
                {blastRadius.impactedAssets.length > 0 ? (
                  <BlastRadiusDiagram
                    rootAsset={asset}
                    impactedAssets={blastRadius.impactedAssets}
                    severity={blastRadius.severity}
                    onSelectAsset={onSelectAsset}
                  />
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">No downstream assets.</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Click a node to see impact.</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Dependencies
            </h4>
            {dependencies.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">None</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-sm text-zinc-400">
                {dependencies.map((d) => (
                  <li key={d.dependencyId}>{d.dependency.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Transfer ownership
            </h4>
            <div className="mt-1.5 space-y-2">
              <input
                type="text"
                placeholder="New owner"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#ff6b35] focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
              <input
                type="text"
                placeholder="Actor (your name)"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#ff6b35] focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
              <button
                onClick={handleTransfer}
                disabled={transferLoading || !newOwner.trim() || !actor.trim()}
                className="w-full rounded-md bg-[#ff6b35] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff7f4d] disabled:opacity-50 disabled:hover:bg-[#ff6b35]"
              >
                {transferLoading ? 'Transferring…' : 'Transfer'}
              </button>
              {transferError && (
                <p className="text-sm text-red-400">{transferError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
