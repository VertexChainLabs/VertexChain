'use client';

import MarkerClusterGroup from 'react-leaflet-cluster';
import type { ReactNode } from 'react';

export default function ClusterMarkers({ children }: { children: ReactNode }) {
  return <MarkerClusterGroup chunkedLoading>{children}</MarkerClusterGroup>;
}
