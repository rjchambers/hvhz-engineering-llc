import { useState, useRef, useCallback } from 'react';
import type { DrainEntry, SecondaryEntry, BuildingOpening, FlowArrow } from '@/lib/drainage-calc';

interface RoofPlanCanvasProps {
  widthFt: number;
  lengthFt: number;
  primaryDrains: DrainEntry[];
  secondaryDrains: SecondaryEntry[];
  openings: BuildingOpening[];
  parapetWalls: string[];
  flowArrows: FlowArrow[];
  onDrainMove?: (type: 'primary' | 'secondary', index: number, pos: { pos_x: number; pos_y: number }) => void;
  onCanvasClick?: (pos: { x: number; y: number }) => void;
  selectedDrainId?: string | null;
  onSelectDrain?: (drainId: string | null) => void;
  readOnly?: boolean;
}

const SVG_W = 500;
const SVG_H = 400;
const PAD = 40;

export function RoofPlanCanvas({
  widthFt, lengthFt, primaryDrains, secondaryDrains,
  openings, parapetWalls, flowArrows,
  onDrainMove, onCanvasClick, selectedDrainId, onSelectDrain, readOnly,
}: RoofPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ type: 'primary' | 'secondary'; index: number } | null>(null);

  const usableW = SVG_W - PAD * 2;
  const usableH = SVG_H - PAD * 2;
  const scaleX = usableW / Math.max(widthFt, 1);
  const scaleY = usableH / Math.max(lengthFt, 1);
  const scale = Math.min(scaleX, scaleY);
  const bw = widthFt * scale;
  const bh = lengthFt * scale;
  const ox = (SVG_W - bw) / 2;
  const oy = (SVG_H - bh) / 2;

  const toSvg = (px: number, py: number) => ({ x: ox + px * bw, y: oy + py * bh });
  const fromSvg = (sx: number, sy: number) => ({
    x: Math.max(0, Math.min(1, (sx - ox) / bw)),
    y: Math.max(0, Math.min(1, (sy - oy) / bh)),
  });

  const getSvgPoint = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm);
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handleMouseDown = (type: 'primary' | 'secondary', index: number, e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setDragging({ type, index });
    onSelectDrain?.(type === 'primary' ? primaryDrains[index]?.drain_id : secondaryDrains[index]?.drain_id);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !onDrainMove) return;
    const svgPt = getSvgPoint(e);
    const norm = fromSvg(svgPt.x, svgPt.y);
    onDrainMove(dragging.type, dragging.index, { pos_x: norm.x, pos_y: norm.y });
  }, [dragging, onDrainMove, getSvgPoint]);

  const handleMouseUp = () => setDragging(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging || readOnly) return;
    const svgPt = getSvgPoint(e);
    // Only trigger if click is within building
    if (svgPt.x >= ox && svgPt.x <= ox + bw && svgPt.y >= oy && svgPt.y <= oy + bh) {
      const norm = fromSvg(svgPt.x, svgPt.y);
      onCanvasClick?.(norm);
    }
    onSelectDrain?.(null);
  };

  const hatchW = 6;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full border rounded bg-white cursor-crosshair select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleSvgClick}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#666" />
        </marker>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#888" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Building outline */}
      <rect x={ox} y={oy} width={bw} height={bh} fill="white" stroke="black" strokeWidth={2} />

      {/* Parapet hatching */}
      {parapetWalls.includes('north') && (
        <rect x={ox} y={oy - hatchW} width={bw} height={hatchW} fill="url(#hatch)" stroke="#888" strokeWidth={0.5} />
      )}
      {parapetWalls.includes('south') && (
        <rect x={ox} y={oy + bh} width={bw} height={hatchW} fill="url(#hatch)" stroke="#888" strokeWidth={0.5} />
      )}
      {parapetWalls.includes('west') && (
        <rect x={ox - hatchW} y={oy} width={hatchW} height={bh} fill="url(#hatch)" stroke="#888" strokeWidth={0.5} />
      )}
      {parapetWalls.includes('east') && (
        <rect x={ox + bw} y={oy} width={hatchW} height={bh} fill="url(#hatch)" stroke="#888" strokeWidth={0.5} />
      )}

      {/* Dimension labels */}
      <text x={ox + bw / 2} y={oy - hatchW - 6} textAnchor="middle" fontSize={11} fill="#333">
        {widthFt}' +/-
      </text>
      <text x={ox - hatchW - 6} y={oy + bh / 2} textAnchor="middle" fontSize={11} fill="#333"
        transform={`rotate(-90, ${ox - hatchW - 6}, ${oy + bh / 2})`}>
        {lengthFt}' +/-
      </text>

      {/* Openings */}
      {openings.map((o) => {
        const oX = ox + o.pos_x * bw;
        const oY = oy + o.pos_y * bh;
        const oW = o.width_pct * bw;
        const oH = o.height_pct * bh;
        return (
          <g key={o.id}>
            <rect x={oX} y={oY} width={oW} height={oH} fill="none" stroke="#999" strokeDasharray="4 2" />
            <text x={oX + oW / 2} y={oY + oH / 2 + 3} textAnchor="middle" fontSize={8} fill="#666">
              {o.label}
            </text>
          </g>
        );
      })}

      {/* Flow arrows */}
      {flowArrows.map((arrow, i) => {
        const from = toSvg(arrow.from_x, arrow.from_y);
        const targetDrain = primaryDrains.find(d => d.drain_id === arrow.to_drain_id);
        if (!targetDrain?.pos_x || !targetDrain?.pos_y) return null;
        const to = toSvg(targetDrain.pos_x, targetDrain.pos_y);
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="#888" strokeWidth={1} markerEnd="url(#arrowhead)" />
        );
      })}

      {/* Primary drains — circles */}
      {primaryDrains.map((d, i) => {
        if (d.pos_x == null || d.pos_y == null) return null;
        const pos = toSvg(d.pos_x, d.pos_y);
        const selected = selectedDrainId === d.drain_id;
        return (
          <g key={d.drain_id}
            onMouseDown={(e) => handleMouseDown('primary', i, e)}
            className={readOnly ? 'cursor-default' : 'cursor-move'}>
            <circle cx={pos.x} cy={pos.y} r={12} fill={selected ? '#e0f2fe' : 'white'}
              stroke={selected ? '#0284c7' : 'black'} strokeWidth={selected ? 2 : 1.5} />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#333">
              {d.drain_id}
            </text>
            {/* Capacity callout */}
            <line x1={pos.x + 12} y1={pos.y} x2={pos.x + 28} y2={pos.y} stroke="#999" strokeWidth={0.5} />
            <text x={pos.x + 30} y={pos.y - 3} fontSize={7} fill="#555">
              {d.pipe_diameter_in}"d {d.leader_type}
            </text>
          </g>
        );
      })}

      {/* Secondary drains — squares/scuppers */}
      {secondaryDrains.map((d, i) => {
        if (d.pos_x == null || d.pos_y == null) return null;
        const pos = toSvg(d.pos_x, d.pos_y);
        const selected = selectedDrainId === d.drain_id;
        if (d.secondary_type === 'Scupper') {
          return (
            <g key={d.drain_id}
              onMouseDown={(e) => handleMouseDown('secondary', i, e)}
              className={readOnly ? 'cursor-default' : 'cursor-move'}>
              <rect x={pos.x - 8} y={pos.y - 5} width={16} height={10}
                fill={selected ? '#fef3c7' : 'url(#hatch)'}
                stroke={selected ? '#d97706' : 'black'} strokeWidth={selected ? 2 : 1.5} />
              <text x={pos.x} y={pos.y + 16} textAnchor="middle" fontSize={7} fill="#555">
                {d.drain_id}
              </text>
            </g>
          );
        }
        return (
          <g key={d.drain_id}
            onMouseDown={(e) => handleMouseDown('secondary', i, e)}
            className={readOnly ? 'cursor-default' : 'cursor-move'}>
            <circle cx={pos.x} cy={pos.y} r={8} fill={selected ? '#fef3c7' : 'white'}
              stroke={selected ? '#d97706' : 'black'} strokeWidth={selected ? 2 : 1.5} />
            <line x1={pos.x - 5} y1={pos.y - 5} x2={pos.x + 5} y2={pos.y + 5} stroke="black" strokeWidth={1} />
            <line x1={pos.x - 5} y1={pos.y + 5} x2={pos.x + 5} y2={pos.y - 5} stroke="black" strokeWidth={1} />
            <text x={pos.x} y={pos.y + 14} textAnchor="middle" fontSize={7} fill="#555">
              {d.drain_id}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD}, ${SVG_H - 20})`}>
        <circle cx={6} cy={0} r={4} fill="white" stroke="black" strokeWidth={1} />
        <text x={14} y={3} fontSize={8} fill="#666">Primary Drain</text>
        <rect x={70} y={-4} width={8} height={8} fill="url(#hatch)" stroke="black" strokeWidth={0.8} />
        <text x={82} y={3} fontSize={8} fill="#666">Scupper</text>
        <circle cx={138} cy={0} r={4} fill="white" stroke="black" strokeWidth={1} />
        <line x1={135} y1={-3} x2={141} y2={3} stroke="black" strokeWidth={0.8} />
        <line x1={135} y1={3} x2={141} y2={-3} stroke="black" strokeWidth={0.8} />
        <text x={146} y={3} fontSize={8} fill="#666">Overflow</text>
        <line x1={200} y1={0} x2={218} y2={0} stroke="#888" strokeWidth={1} markerEnd="url(#arrowhead)" />
        <text x={222} y={3} fontSize={8} fill="#666">Flow Direction</text>
        <rect x={290} y={-4} width={12} height={8} fill="url(#hatch)" stroke="#888" strokeWidth={0.5} />
        <text x={306} y={3} fontSize={8} fill="#666">Parapet</text>
      </g>
    </svg>
  );
}
