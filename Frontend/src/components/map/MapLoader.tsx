'use client'; // This marks the component as a Client Component

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

export default function MapLoader() {
  const Map = useMemo(
    () =>
      dynamic(() => import('@/components/map/Map'), {
        loading: () => (
          <div role="status" aria-live="polite" className="flex items-center justify-center h-64 text-gray-400">
            <span>Map is loading...</span>
          </div>
        ),
        ssr: false, // This is allowed here!
      }),
    []
  );

  return <Map />;
}
