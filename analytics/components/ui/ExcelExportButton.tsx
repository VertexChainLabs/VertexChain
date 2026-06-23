'use client';

import { useState } from 'react';
import { downloadAnalyticsWorkbook } from '@/lib/excel-export';

export default function ExcelExportButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      await downloadAnalyticsWorkbook();
      setStatus('Workbook generated with Overview, Users, Locations, and Engagement sheets.');
      window.setTimeout(() => setStatus(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        style={{
          border: 'none',
          borderRadius: 999,
          background: loading ? '#a7f3d0' : '#166534',
          color: '#ffffff',
          padding: '12px 18px',
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 12px 30px rgba(22,101,52,0.20)',
        }}
      >
        {loading ? 'Generating...' : 'Download Excel Workbook'}
      </button>

      {status && (
        <span style={{ fontSize: 12, color: '#166534' }}>
          {status}
        </span>
      )}

      {error && (
        <span style={{ fontSize: 12, color: '#b91c1c' }}>
          {error}
        </span>
      )}
    </div>
  );
}
