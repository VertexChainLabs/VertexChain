'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type GeoRegion,
  type LatLng,
  computeRegionStats,
  filterGistsInRegion,
  loadRegions,
  saveRegions,
} from '@/lib/geofencing';
import { MOCK_GISTS, CANVAS_W, CANVAS_H, SENTIMENT_COLOR, toCanvas, fromCanvas } from '@/lib/geofence-data';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GeoFence() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPoly, setCurrentPoly] = useState<LatLng[]>([]);
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regionName, setRegionName] = useState('');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadRegions().then((data) => setRegions(data));
  }, []);

  useEffect(() => {
    const active = regions.find((r) => r.id === selectedId);
    setEditName(active ? active.name : '');
  }, [selectedId, regions]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    setCurrentPoly((prev) => [...prev, fromCanvas(x, y)]);
  };

  const closePolygon = async () => {
    if (currentPoly.length < 3) return;
    const name = regionName.trim() || `Region ${regions.length + 1}`;
    try {
      const res = await fetch('/api/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, polygon: currentPoly }),
      });
      if (res.ok) {
        const newRegion = await res.json();
        setRegions((prev) => [...prev, newRegion]);
        setCurrentPoly([]);
        setDrawing(false);
        setRegionName('');
        setSelectedId(newRegion.id);
      }
    } catch (err) {
      console.error('Failed to create region:', err);
    }
  };

  const deleteRegion = async (id: string) => {
    try {
      const res = await fetch(`/api/regions/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRegions((prev) => prev.filter((r) => r.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to delete region:', err);
    }
  };

  const updateRegion = async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/regions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRegions((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } catch (err) {
      console.error('Failed to update region:', err);
    }
  };

  const selected = regions.find((r) => r.id === selectedId) ?? null;
  const gistsInRegion = selected ? filterGistsInRegion(MOCK_GISTS, selected.polygon) : [];
  const stats = computeRegionStats(gistsInRegion);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {!drawing ? (
          <button
            onClick={() => { setDrawing(true); setCurrentPoly([]); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Draw Region
          </button>
        ) : (
          <>
            <input
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Region name…"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              onClick={closePolygon}
              disabled={currentPoly.length < 3}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
            >
              Close & Save ({currentPoly.length} pts)
            </button>
            <button
              onClick={() => { setDrawing(false); setCurrentPoly([]); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </>
        )}
        {drawing && (
          <span className="text-xs text-gray-500">Click on the map to add polygon vertices.</span>
        )}
      </div>

      {/* Map canvas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="w-full"
          style={{ cursor: drawing ? 'crosshair' : 'default', background: '#e8f4f8' }}
          onClick={handleSvgClick}
        >
          {/* Grid */}
          {[...Array(6)].map((_, i) => (
            <line key={`v${i}`} x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={CANVAS_H} stroke="#ccc" strokeWidth={0.5} />
          ))}
          {[...Array(4)].map((_, i) => (
            <line key={`h${i}`} x1={0} y1={(i + 1) * 90} x2={CANVAS_W} y2={(i + 1) * 90} stroke="#ccc" strokeWidth={0.5} />
          ))}

          {/* Saved regions */}
          {regions.map((r) => {
            const pts = r.polygon.map(toCanvas);
            const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
            const isSelected = r.id === selectedId;
            return (
              <g key={r.id} onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }} style={{ cursor: 'pointer' }}>
                <path d={d} fill={isSelected ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)'} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={isSelected ? 2 : 1} />
                {pts[0] && <text x={pts[0][0]} y={pts[0][1] - 6} fontSize={11} fill="#4338ca" fontWeight={600}>{r.name}</text>}
              </g>
            );
          })}

          {/* In-progress polygon */}
          {currentPoly.length > 0 && (
            <>
              <polyline
                points={currentPoly.map(toCanvas).map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
              {currentPoly.map((p, i) => {
                const [x, y] = toCanvas(p);
                return <circle key={i} cx={x} cy={y} r={4} fill="#f59e0b" />;
              })}
            </>
          )}

          {/* Gist dots */}
          {MOCK_GISTS.map((g) => {
            const [x, y] = toCanvas({ lat: g.lat, lng: g.lng });
            return (
              <circle key={g.id} cx={x} cy={y} r={6} fill={SENTIMENT_COLOR[g.sentiment]} stroke="#fff" strokeWidth={1.5} opacity={0.9}>
                <title>{g.text}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Saved regions list */}
      {regions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Saved Regions</h2>
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <div key={r.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer ${r.id === selectedId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-700'}`} onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}>
                <span>{r.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteRegion(r.id); }} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Region stats */}
      {selected && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Stats — {selected.name}
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 bg-transparent"
                placeholder="Rename region..."
              />
              <button
                onClick={() => updateRegion(selected.id, editName)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Total Gists', value: stats.total, color: 'text-gray-800 dark:text-gray-100' },
              { label: 'Positive',    value: stats.positive, color: 'text-green-600' },
              { label: 'Negative',    value: stats.negative, color: 'text-red-600' },
              { label: 'Neutral',     value: stats.neutral,  color: 'text-gray-500' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {gistsInRegion.length > 0 && (
            <ul className="space-y-1">
              {gistsInRegion.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span style={{ color: SENTIMENT_COLOR[g.sentiment] }}>●</span>
                  <span className="text-gray-700 dark:text-gray-300">{g.text}</span>
                </li>
              ))}
            </ul>
          )}
          {gistsInRegion.length === 0 && (
            <p className="text-sm text-gray-400">No gists found inside this region.</p>
          )}
        </div>
      )}
    </div>
  );
}
