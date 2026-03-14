import { X, AlertCircle, PauseCircle, GitBranch, Zap, Users } from 'lucide-react';
import type { HealthReportResponse } from '../types';

interface HealthPanelProps {
  report: HealthReportResponse;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score > 80 ? 'text-emerald-400' : score > 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`text-5xl font-bold tabular-nums ${color}`}>
      {score}
      <span className="ml-1 text-2xl font-normal text-zinc-500">/100</span>
    </div>
  );
}

export function HealthPanel({ report, onClose }: HealthPanelProps) {
  const { assets: spofAssets } = report.singlePointsOfFailure;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a3a] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Governance health</h2>
          <button
            onClick={onClose}
            className="rounded p-2 text-zinc-400 transition-colors hover:bg-[#2a2a3a] hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-6 flex items-baseline gap-4">
            <ScoreBadge score={report.healthScore} />
            <span className="text-sm text-zinc-500">Overall score</span>
          </div>

          <section className="mb-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Issue breakdown
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-3 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
                <Users className="size-5 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-300">Orphaned assets</span>
                  <p className="text-sm text-zinc-500">No owner assigned</p>
                </div>
                <span className="text-lg font-semibold text-white">{report.orphaned.count}</span>
              </li>
              <li className="flex items-center gap-3 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
                <PauseCircle className="size-5 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-300">Paused / disabled</span>
                  <p className="text-sm text-zinc-500">Not running</p>
                </div>
                <span className="text-lg font-semibold text-white">{report.errorOrPaused.count}</span>
              </li>
              <li className="flex items-center gap-3 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
                <GitBranch className="size-5 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-300">Circular dependencies</span>
                  <p className="text-sm text-zinc-500">Cycle detected</p>
                </div>
                <span className="text-lg font-semibold text-white">
                  {report.circularDependencies.detected ? 'Yes' : 'No'}
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
                <Zap className="size-5 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-300">Single points of failure</span>
                  <p className="text-sm text-zinc-500">3+ dependents</p>
                </div>
                <span className="text-lg font-semibold text-white">{report.singlePointsOfFailure.count}</span>
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Per-workspace
            </h3>
            <div className="rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a3a] text-left text-zinc-500">
                    <th className="px-4 py-2.5 font-medium">Workspace</th>
                    <th className="px-4 py-2.5 font-medium text-right">Assets</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perWorkspace.map((w) => (
                    <tr key={w.workspace} className="border-b border-[#2a2a3a]/50 last:border-0">
                      <td className="px-4 py-2.5 text-zinc-300">{w.workspace}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-400">{w.assetCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {spofAssets.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Single points of failure
              </h3>
              <ul className="space-y-2">
                {spofAssets.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-300">{a.name}</p>
                      <p className="text-xs text-zinc-500">{a.workspace} · {a.type}</p>
                    </div>
                    <span className="ml-2 shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                      {a.dependentCount ?? 0} dependents
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.deductions.length > 0 && (
            <div className="mt-6 flex gap-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
              <AlertCircle className="size-5 shrink-0 text-zinc-500" />
              <ul className="space-y-0.5 text-sm text-zinc-400">
                {report.deductions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
