'use client';

import { useEffect, useMemo, useState } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import {
  STORAGE_KEY,
  SHARE_PARAM,
  widgetLibrary,
  createWidget,
  encodeLayout,
  decodeLayout,
  type WidgetType,
  type WidgetItem,
} from '@/lib/report-builder-types';
import WidgetCard from '@/components/ui/WidgetCard';

interface ReportBuilderProps {
  heading: string;
  description: string;
}

export default function ReportBuilder({ heading, description }: ReportBuilderProps) {
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    const fromUrl = decodeLayout(new URLSearchParams(window.location.search).get(SHARE_PARAM));
    const fromStorage = decodeLayout(window.localStorage.getItem(STORAGE_KEY));
    const initial = fromUrl ?? fromStorage ?? [
      createWidget('chart', 0),
      createWidget('kpi', 1),
      createWidget('table', 2),
    ];

    setWidgets(initial);
  }, []);

  useEffect(() => {
    if (widgets.length === 0) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, encodeURIComponent(JSON.stringify(widgets)));

    const nextUrl = `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${encodeLayout(
      widgets,
    )}`;
    setShareUrl(nextUrl);
  }, [widgets]);

  const nextIndex = useMemo(() => widgets.length + 1, [widgets.length]);

  const addWidget = (type: WidgetType) => {
    setWidgets((current) => [...current, createWidget(type, current.length + 1)]);
    setStatus('Widget added to the report canvas.');
  };

  const removeWidget = (id: string) => {
    setWidgets((current) => current.filter((widget) => widget.i !== id));
    setStatus('Widget removed from the report.');
  };

  const saveLayout = () => {
    window.localStorage.setItem(STORAGE_KEY, encodeURIComponent(JSON.stringify(widgets)));
    setStatus('Custom layout saved locally.');
  };

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setStatus('Shareable report URL copied to clipboard.');
  };

  const onLayoutChange = (layout: Layout[]) => {
    setWidgets((current) =>
      current.map((widget) => {
        const next = layout.find((item) => item.i === widget.i);
        return next ? { ...widget, ...next } : widget;
      }),
    );
  };

  return (
    <main
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '40px 24px 64px',
      }}
    >
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
        className="md:grid-cols-[320px_minmax(0,1fr)]"
      >
        <aside
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid rgba(148,163,184,0.16)',
            boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 999,
              padding: '6px 12px',
              background: '#111827',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Widget Library
          </div>

          <h1 style={{ margin: '0 0 10px', fontSize: 34, lineHeight: 1.05 }}>
            {heading}
          </h1>

          <p style={{ margin: '0 0 20px', color: '#475569', fontSize: 15 }}>
            {description}
          </p>

          <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
            {widgetLibrary.map((widget) => (
              <div
                key={widget.type}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/widget-type', widget.type);
                }}
                style={{
                  borderRadius: 18,
                  border: '1px solid #e2e8f0',
                  padding: '14px 16px',
                  background: '#ffffff',
                  cursor: 'grab',
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: widget.accent,
                    marginBottom: 10,
                  }}
                />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{widget.title}</div>
                <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
                  {widget.description}
                </div>
                <button
                  type="button"
                  onClick={() => addWidget(widget.type)}
                  style={{
                    border: 'none',
                    borderRadius: 12,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Add to canvas
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <button
              type="button"
              onClick={saveLayout}
              style={{
                border: 'none',
                borderRadius: 14,
                background: '#1d4ed8',
                color: '#ffffff',
                padding: '12px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save layout
            </button>

            <button
              type="button"
              onClick={copyShareUrl}
              disabled={!shareUrl}
              style={{
                border: '1px solid #bfdbfe',
                borderRadius: 14,
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '12px 14px',
                fontWeight: 700,
                cursor: shareUrl ? 'pointer' : 'not-allowed',
              }}
            >
              Copy share URL
            </button>

            {status && <div style={{ color: '#0f766e', fontSize: 13 }}>{status}</div>}
          </div>
        </aside>

        <section
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('text/widget-type') as WidgetType;
            if (type) {
              setWidgets((current) => [...current, createWidget(type, current.length + nextIndex)]);
              setStatus('Widget dropped into the report canvas.');
            }
          }}
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid rgba(148,163,184,0.16)',
            boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
            minHeight: 760,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Report Canvas
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>Custom analytics layout</div>
            </div>
            <div style={{ color: '#64748b', fontSize: 13 }}>
              Drag cards below to reorder and resize the report.
            </div>
          </div>

          <GridLayout
            className="layout"
            layout={widgets}
            cols={12}
            rowHeight={72}
            width={820}
            margin={[16, 16]}
            onLayoutChange={onLayoutChange}
            draggableHandle=".widget-drag-handle"
            resizeHandle={
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 10,
                  width: 16,
                  height: 16,
                  borderRadius: 6,
                  background: '#cbd5e1',
                }}
              />
            }
          >
            {widgets.map((widget) => (
              <div key={widget.i}>
                <WidgetCard widget={widget} onRemove={removeWidget} />
              </div>
            ))}
          </GridLayout>

          {widgets.length === 0 && (
            <div
              style={{
                marginTop: 24,
                borderRadius: 18,
                border: '1px dashed #94a3b8',
                padding: '28px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Drop widgets here to start your custom report.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
