'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { copyChartImage, downloadChartImage, type ExportBackground } from '@/lib/chart-export';

interface ChartExportCardProps {
  title: string;
  children: ReactNode;
}

export default function ChartExportCard({ title, children }: ChartExportCardProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [background, setBackground] = useState<ExportBackground>('white');
  const [status, setStatus] = useState<string | null>(null);

  const withElement = async (action: (element: HTMLElement) => Promise<void>) => {
    if (!captureRef.current) {
      return;
    }

    await action(captureRef.current);
  };

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: '24px 24px 28px',
        border: '1px solid rgba(148,163,184,0.16)',
        boxShadow: '0 16px 40px rgba(15,23,42,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            Export this chart as a high-resolution PNG or copy it to the clipboard.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
            <span>Background</span>
            <select
              value={background}
              onChange={(event) => setBackground(event.target.value as ExportBackground)}
              style={{
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                padding: '8px 10px',
                fontSize: 13,
                background: '#ffffff',
              }}
            >
              <option value="white">White</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              withElement(async (element) => {
                try {
                  await downloadChartImage(title, element, background);
                  setStatus('PNG downloaded successfully.');
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : 'Download failed.');
                }
              })
            }
            style={{
              border: 'none',
              borderRadius: 999,
              background: '#1d4ed8',
              color: '#ffffff',
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Download PNG
          </button>

          <button
            type="button"
            onClick={() =>
              withElement(async (element) => {
                try {
                  await copyChartImage(element, background);
                  setStatus('PNG copied to clipboard.');
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : 'Clipboard copy failed.');
                }
              })
            }
            style={{
              border: '1px solid #bfdbfe',
              borderRadius: 999,
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Copy Image
          </button>
        </div>
      </div>

      {status && (
        <div style={{ marginBottom: 12, fontSize: 13, color: '#0f766e' }}>
          {status}
        </div>
      )}

      <div
        ref={captureRef}
        style={{
          background: background === 'white' ? '#ffffff' : 'transparent',
          borderRadius: 18,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
        {children}
      </div>
    </section>
  );
}
