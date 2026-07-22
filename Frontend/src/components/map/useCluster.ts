import dynamic from 'next/dynamic';
import type { ComponentType, ReactNode } from 'react';

export const CLUSTER_THRESHOLD = 100;

type ClusterComp = ComponentType<{ children: ReactNode }>;

const HeavyCluster: ClusterComp = dynamic(() => import('./cluster'), { ssr: false });

export function useCluster(gistCount: number): ClusterComp | null {
  return gistCount > CLUSTER_THRESHOLD ? HeavyCluster : null;
}
