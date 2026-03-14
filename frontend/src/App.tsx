import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, ShieldAlert, X } from 'lucide-react';
import { fetchAssets, fetchBlastRadius, fetchHealthReport } from './api';
import type { Asset } from './types';
import type { BlastRadiusResponse, HealthReportResponse } from './types';
import { layoutNodes } from './lib/layout';
import { AssetNode, type AssetNodeData } from './components/AssetNode';
import { AssetSidebar } from './components/AssetSidebar';
import { GraphSkeleton } from './components/GraphSkeleton';
import { HealthPanel } from './components/HealthPanel';
import { getFriendlyErrorMessage } from './api';

const nodeTypes: NodeTypes = { asset: AssetNode };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

function buildFlowData(
  assets: Asset[],
  blastState: { rootId: string | null; impactedIds: Set<string> } | null
): { nodes: Node<AssetNodeData>[]; edges: Edge[] } {
  const positions = layoutNodes(assets);
  const nodes: Node<AssetNodeData>[] = assets.map((asset) => {
    const pos = positions.get(asset.id) ?? { x: 0, y: 0 };
    const highlighted = blastState ? blastState.impactedIds.has(asset.id) && asset.id !== blastState.rootId : false;
    const blastRoot = blastState ? asset.id === blastState.rootId : false;
    const dimmed = blastState && blastState.rootId ? !blastState.impactedIds.has(asset.id) && asset.id !== blastState.rootId : false;
    return {
      id: asset.id,
      type: 'asset',
      position: pos,
      data: {
        asset,
        highlighted,
        blastRoot,
        dimmed,
      },
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
    };
  });

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const asset of assets) {
    const deps = asset.dependenciesAsDependent ?? [];
    for (const d of deps) {
      const key = `${d.dependentId}-${d.dependencyId}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({
        id: key,
        source: d.dependentId,
        target: d.dependencyId,
        animated: !!blastState?.impactedIds.has(d.dependentId) && blastState.impactedIds.has(d.dependencyId),
        style: blastState?.impactedIds.has(d.dependentId) && blastState.impactedIds.has(d.dependencyId)
          ? { stroke: '#ef4444', strokeWidth: 2 }
          : undefined,
      });
    }
  }

  return { nodes, edges };
}

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'zap' | 'connection'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationSimulation, setMigrationSimulation] = useState<{
    connectionId: string;
    connectionName: string;
    blastRadius: BlastRadiusResponse;
  } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [blastRadiusResponse, setBlastRadiusResponse] = useState<BlastRadiusResponse | null>(null);
  const [blastRadiusLoading, setBlastRadiusLoading] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthReportResponse | null>(null);
  const [connectionAssets, setConnectionAssets] = useState<Asset[]>([]);

  const blastState = useMemo((): { rootId: string; impactedIds: Set<string> } | null => {
    if (migrationSimulation) {
      const r = migrationSimulation.blastRadius;
      return {
        rootId: r.root.id,
        impactedIds: new Set([r.root.id, ...r.impactedAssets.map((a) => a.id)]),
      };
    }
    if (selectedAsset && blastRadiusResponse) {
      return {
        rootId: selectedAsset.id,
        impactedIds: new Set([
          selectedAsset.id,
          ...blastRadiusResponse.impactedAssets.map((a) => a.id),
        ]),
      };
    }
    return null;
  }, [migrationSimulation, selectedAsset, blastRadiusResponse]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAssets({
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: search.trim() || undefined,
      });
      setAssets(res.data);
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Failed to load assets'));
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    fetchAssets({ type: 'connection' })
      .then((res) => setConnectionAssets(res.data))
      .catch(() => {});
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = buildFlowData(assets, blastState);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowData(assets, blastState);
    setNodes(n);
    setEdges(e);
  }, [assets, blastState, setNodes, setEdges]);

  const onNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node<AssetNodeData>) => {
      const id = node.id;
      const asset = node.data?.asset;
      setMigrationSimulation(null);
      if (asset) setSelectedAsset(asset);
      setBlastRadiusResponse(null);
      setBlastRadiusLoading(true);
      try {
        const res = await fetchBlastRadius(id);
        setBlastRadiusResponse(res);
      } catch {
        setBlastRadiusResponse(null);
      } finally {
        setBlastRadiusLoading(false);
      }
    },
    []
  );

  const closeSidebar = useCallback(() => {
    setSelectedAsset(null);
    setBlastRadiusResponse(null);
  }, []);

  const onMigrationSimulationSelect = useCallback(
    async (connectionId: string) => {
      if (!connectionId) {
        setMigrationSimulation(null);
        return;
      }
      const connection = connectionAssets.find((a) => a.id === connectionId);
      setSelectedAsset(null);
      setBlastRadiusResponse(null);
      setMigrationSimulation(null);
      try {
        const blastRadius = await fetchBlastRadius(connectionId);
        setMigrationSimulation({
          connectionId,
          connectionName: connection?.name ?? blastRadius.root.name,
          blastRadius,
        });
      } catch {
        setMigrationSimulation(null);
      }
    },
    [connectionAssets]
  );

  const clearMigrationSimulation = useCallback(() => {
    setMigrationSimulation(null);
  }, []);

  const handleAssetUpdated = useCallback((updated: Asset) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    );
    setSelectedAsset((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  const runGovernanceScan = useCallback(async () => {
    try {
      const report = await fetchHealthReport();
      setHealthReport(report);
    } catch (e) {
      setHealthReport({
        orphaned: { count: 0, assets: [] },
        errorOrPaused: { count: 0, assets: [] },
        circularDependencies: { detected: false, cycles: [] },
        singlePointsOfFailure: { count: 0, assets: [] },
        perWorkspace: [],
        healthScore: 0,
        deductions: [e instanceof Error ? e.message : 'Failed to load report'],
      });
    }
  }, []);

  const simulationBanner =
    migrationSimulation && migrationSimulation.blastRadius.impactedAssets.length > 0
      ? (() => {
          const r = migrationSimulation.blastRadius;
          const n = r.impactedAssets.length;
          const workspaces = [...new Set(r.impactedAssets.map((a) => a.workspace))];
          const workspaceLabel =
            workspaces.length <= 2
              ? workspaces.join(' and ')
              : `${workspaces.length} workspaces`;
          return `Disconnecting ${migrationSimulation.connectionName} would impact ${n} zap${n === 1 ? '' : 's'} across ${workspaceLabel}`;
        })()
      : migrationSimulation
        ? `Disconnecting ${migrationSimulation.connectionName} would impact 0 zaps`
        : null;

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      <header className="flex shrink-0 flex-col gap-0 border-b border-[#2a2a3a] bg-[#12121a]">
        <div className="flex items-center gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">Zap Asset Graph</h1>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#ff6b35] focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
            </div>
            <div className="flex rounded-md border border-[#2a2a3a] p-0.5">
              {(['all', 'zap', 'connection'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded px-3 py-1 text-sm font-medium capitalize transition-colors ${
                    typeFilter === t
                      ? 'bg-[#ff6b35] text-white'
                      : 'text-zinc-400 hover:bg-[#2a2a3a] hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="whitespace-nowrap">Migration Simulator</span>
                <select
                  value={migrationSimulation?.connectionId ?? ''}
                  onChange={(e) => onMigrationSimulationSelect(e.target.value)}
                  className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] py-1.5 pl-3 pr-8 text-sm text-white focus:border-[#ff6b35] focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                >
                  <option value="">Simulate disconnecting…</option>
                  {connectionAssets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {migrationSimulation && (
                <button
                  onClick={clearMigrationSimulation}
                  className="flex items-center gap-1.5 rounded-md border border-[#2a2a3a] px-2.5 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400"
                >
                  <X size={14} />
                  Clear simulation
                </button>
              )}
            </div>
          </div>
          <button
            onClick={runGovernanceScan}
            className="flex items-center gap-2 rounded-md border border-[#2a2a3a] bg-[#12121a] px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-[#ff6b35] hover:bg-[#2a2a3a] hover:text-white"
          >
            <ShieldAlert size={16} />
            Governance Scan
          </button>
        </div>
        {simulationBanner && (
          <div className="flex items-center gap-3 border-t border-[#2a2a3a] bg-amber-950/30 px-4 py-2.5 text-sm text-amber-200">
            <span className="font-medium">{simulationBanner}</span>
          </div>
        )}
      </header>

      <main className="relative flex flex-1 min-h-0">
        <div className="relative min-h-0 min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.5}
            defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#2a2a3a' } }}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0a0a0f]"
          >
          <Background color="#2a2a3a" gap={16} size={0.5} />
          <Controls className="!border-[#2a2a3a] !bg-[#12121a] [&>button]:!border-[#2a2a3a] [&>button]:!bg-[#12121a] [&>button]:!text-white [&>button:hover]:!bg-[#2a2a3a]" />
          <MiniMap
            nodeColor="#2a2a3a"
            maskColor="rgba(10,10,15,0.8)"
            className="!bg-[#12121a] !border-[#2a2a3a]"
          />
          {loading && assets.length === 0 && <GraphSkeleton />}
          {loading && assets.length > 0 && (
            <Panel position="top-left" className="rounded border border-[#2a2a3a] bg-[#12121a] px-3 py-2 text-sm text-zinc-400">
              Updating…
            </Panel>
          )}
          {error && (
            <Panel position="top-left" className="max-w-md rounded border border-red-500/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              <p className="font-medium">Couldn’t load assets</p>
              <p className="mt-1 text-red-300/90">{error}</p>
            </Panel>
          )}
          </ReactFlow>
        </div>
        {selectedAsset && (
          <AssetSidebar
            asset={selectedAsset}
            blastRadius={blastRadiusResponse}
            blastRadiusLoading={blastRadiusLoading}
            onClose={closeSidebar}
            onAssetUpdated={handleAssetUpdated}
          />
        )}
      </main>

      {healthReport && (
        <HealthPanel report={healthReport} onClose={() => setHealthReport(null)} />
      )}
    </div>
  );
}
