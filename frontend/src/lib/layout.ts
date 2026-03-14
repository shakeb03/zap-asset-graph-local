const COLUMN_GAP = 320;
const ROW_GAP = 100;
const CONNECTION_X = 80;
const ZAP_X = CONNECTION_X + COLUMN_GAP;

export interface LayoutAsset {
  id: string;
  type: 'zap' | 'connection';
}

export function layoutNodes<T extends LayoutAsset>(assets: T[]): Map<string, { x: number; y: number }> {
  const connections = assets.filter((a) => a.type === 'connection');
  const zaps = assets.filter((a) => a.type === 'zap');
  const positions = new Map<string, { x: number; y: number }>();

  connections.forEach((a, i) => {
    positions.set(a.id, { x: CONNECTION_X, y: 80 + i * ROW_GAP });
  });
  zaps.forEach((a, i) => {
    positions.set(a.id, { x: ZAP_X, y: 80 + i * ROW_GAP });
  });

  return positions;
}
