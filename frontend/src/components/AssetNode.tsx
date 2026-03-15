import { memo } from 'react';
import { Zap, Link2 } from 'lucide-react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Asset } from '../types';

export type AssetNodeData = {
  asset: Asset;
  highlighted?: boolean;
  blastRoot?: boolean;
  dimmed?: boolean;
};

export type AssetNodeType = Node<AssetNodeData, 'asset'>;

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  disabled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
};

function AssetNodeComponent({ data, selected }: NodeProps<AssetNodeType>) {
  const { asset, highlighted, blastRoot, dimmed } = data ?? {};
  if (!asset) return null;

  const opacity = dimmed ? 'opacity-40' : 'opacity-100';
  const border = highlighted
    ? 'border-red-500 ring-2 ring-red-500/30'
    : blastRoot
      ? 'border-[#ff6b35] ring-2 ring-[#ff6b35]/40'
      : 'border-[#2a2a3a]';
  const statusClass = statusColors[asset.status] ?? statusColors.disabled;

  return (
    <div
      className={`
        relative min-w-[200px] max-w-[240px] rounded-lg border-2 bg-[#12121a] px-3 py-2.5
        transition-all duration-200
        ${border} ${opacity}
        ${selected ? 'ring-2 ring-[#ff6b35]/50' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 !border-[#4a4a5a] !bg-[#12121a]" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 !border-[#4a4a5a] !bg-[#12121a]" />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[#ff6b35]">
          {asset.type === 'zap' ? <Zap size={18} strokeWidth={2} /> : <Link2 size={18} strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white" title={asset.name}>
            {asset.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {asset.type}
            </span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${statusClass}`}>
              {asset.status}
            </span>
          </div>
          {asset.owner == null && (
            <p className="mt-1.5 text-xs text-amber-400">No owner</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const AssetNode = memo(AssetNodeComponent);
