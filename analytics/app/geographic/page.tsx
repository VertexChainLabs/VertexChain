'use client';

import GeoFence from '@/components/GeoFence';

export default function GeographicPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Geofencing Regions</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Create, edit, and manage geofencing regions to filter gist distributions across areas.
        </p>
      </div>

      <GeoFence />
    </div>
  );
}
