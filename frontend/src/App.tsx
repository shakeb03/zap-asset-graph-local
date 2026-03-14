import { useCallback, useEffect, useState } from 'react';
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
import { Search, ShieldAlert } from 'lucide-react';
import { fetchAssets, fetchBlastRadius, fetchHealthReport } from './api';
import type { Asset } from './types';
import type { BlastRadiusResponse, HealthReportResponse } from './types';
import { layoutNodes } from './lib/layout';
import { AssetNode, type AssetNodeData } from './components/AssetNode';
import { AssetSidebar } from './components/AssetSidebar';
import { HealthPanel } from './components/HealthPanel';

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
  const [blastState, setBlastState] = useState<{ rootId: string; impactedIds: Set<string> } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [blastRadiusResponse, setBlastRadiusResponse] = useState<BlastRadiusResponse | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReportResponse | null>(null);

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
      setError(e instanceof Error ? e.message : 'Failed to load assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

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
      if (asset) setSelectedAsset(asset);
      setBlastRadiusResponse(null);
      setBlastState(null);
      try {
        const res = await fetchBlastRadius(id);
        const impactedIds = new Set<string>([id, ...res.impactedAssets.map((a) => a.id)]);
        setBlastState({ rootId: id, impactedIds });
        setBlastRadiusResponse(res);
      } catch {
        setBlastState({ rootId: id, impactedIds: new Set([id]) });
      }
    },
    []
  );

  const closeSidebar = useCallback(() => {
    setSelectedAsset(null);
    setBlastRadiusResponse(null);
    setBlastState(null);
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

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      <header className="flex shrink-0 items-center gap-4 border-b border-[#2a2a3a] bg-[#12121a] px-4 py-3">
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
        </div>
        <button
          onClick={runGovernanceScan}
          className="flex items-center gap-2 rounded-md border border-[#2a2a3a] bg-[#12121a] px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-[#ff6b35] hover:bg-[#2a2a3a] hover:text-white"
        >
          <ShieldAlert size={16} />
          Governance Scan
        </button>
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
          {loading && (
            <Panel position="top-left" className="rounded border border-[#2a2a3a] bg-[#12121a] px-3 py-2 text-sm text-zinc-400">
              Loading…
            </Panel>
          )}
          {error && (
            <Panel position="top-left" className="rounded border border-red-500/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">
              {error}
            </Panel>
          )}
          </ReactFlow>
        </div>
        {selectedAsset && (
          <AssetSidebar
            asset={selectedAsset}
            blastRadius={blastRadiusResponse}
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
