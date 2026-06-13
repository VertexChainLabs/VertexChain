'use client';

import { widgetLibrary, type WidgetItem } from '@/lib/report-builder-types';

interface WidgetCardProps {
  widget: WidgetItem;
  onRemove: (id: string) => void;
}

export default function WidgetCard({ widget, onRemove }: WidgetCardProps) {
  const definition = widgetLibrary.find((item) => item.type === widget.widgetType)!;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid rgba(148,163,184,0.16)',
        boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
        padding: 18,
        overflow: 'hidden',
      }}
    >
      <div
        className="widget-drag-handle"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          cursor: 'grab',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{widget.title}</div>
          <div style={{ color: '#64748b', fontSize: 13 }}>{definition.description}</div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(widget.i)}
          style={{
            border: 'none',
            borderRadius: 999,
            background: '#f1f5f9',
            color: '#334155',
            padding: '8px 10px',
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </div>

      <div
        style={{
          height: 'calc(100% - 56px)',
          borderRadius: 16,
          background: `${definition.accent}14`,
          border: `1px solid ${definition.accent}33`,
          padding: 16,
          display: 'grid',
          alignContent: 'space-between',
        }}
      >
        <div style={{ color: definition.accent, fontWeight: 700, fontSize: 13 }}>
          {widget.widgetType.toUpperCase()} WIDGET
        </div>

        <div>
          {widget.widgetType === 'kpi' && (
            <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a' }}>18.4k</div>
          )}
          {widget.widgetType === 'chart' && (
            <div
              style={{
                height: 110,
                borderRadius: 14,
                background: 'linear-gradient(180deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.02) 100%)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  right: 16,
                  bottom: 18,
                  height: 2,
                  background: '#93c5fd',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 18,
                  top: 24,
                  borderRadius: 12,
                  borderLeft: '3px solid #2563eb',
                  borderTop: '3px solid transparent',
                  transform: 'skewY(-14deg)',
                }}
              />
            </div>
          )}
          {widget.widgetType === 'table' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {['Lagos', 'Abuja', 'Kano'].map((row, index) => (
                <div
                  key={row}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    borderRadius: 12,
                    background: '#ffffff',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                >
                  <span>{row}</span>
                  <span>{180 - index * 24}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
