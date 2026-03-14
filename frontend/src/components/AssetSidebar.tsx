import { useState } from 'react';
import { X, ExternalLink, ArrowRight } from 'lucide-react';
import type { Asset } from '../types';
import type { BlastRadiusResponse } from '../types';
import { transferOwnership } from '../api';

interface AssetSidebarProps {
  asset: Asset;
  blastRadius: BlastRadiusResponse | null;
  onClose: () => void;
  onAssetUpdated?: (asset: Asset) => void;
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

const severityColors: Record<string, string> = {
  none: 'bg-zinc-600 text-zinc-300',
  low: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  medium: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  high: 'bg-red-500/20 text-red-400 border border-red-500/40',
};

export function AssetSidebar({ asset, blastRadius, onClose, onAssetUpdated }: AssetSidebarProps) {
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
      setTransferError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  const dependencies = asset.dependenciesAsDependent ?? [];
  const severity = blastRadius?.severity ?? 'none';
  const severityClass = severityColors[severity] ?? severityColors.none;

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

          {blastRadius && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Blast radius
              </h4>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-300">
                  {blastRadius.totalImpacted} impacted
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${severityClass}`}>
                  {blastRadius.severity}
                </span>
              </div>
              {blastRadius.impactedAssets.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-zinc-400">
                  {blastRadius.impactedAssets.map((a) => (
                    <li key={a.id} className="truncate">
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
