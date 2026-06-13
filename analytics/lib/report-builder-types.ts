import { type Layout } from 'react-grid-layout';

export type WidgetType = 'chart' | 'table' | 'kpi';

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  accent: string;
}

export interface WidgetItem extends Layout {
  widgetType: WidgetType;
  title: string;
}

export const STORAGE_KEY = 'vertexchain-report-builder-layout';
export const SHARE_PARAM = 'layout';

export const widgetLibrary: WidgetDefinition[] = [
  {
    type: 'chart',
    title: 'Trend Chart',
    description: 'Use for timeline and category trend snapshots.',
    accent: '#2563eb',
  },
  {
    type: 'table',
    title: 'Top Locations Table',
    description: 'Summarize ranked regions, categories, or authors.',
    accent: '#7c3aed',
  },
  {
    type: 'kpi',
    title: 'Headline KPI',
    description: 'Highlight total gists, growth rate, or engagement.',
    accent: '#059669',
  },
];

export function createWidget(type: WidgetType, index: number): WidgetItem {
  const definition = widgetLibrary.find((widget) => widget.type === type)!;

  return {
    i: `${type}-${index}`,
    x: (index * 2) % 6,
    y: Infinity,
    w: type === 'kpi' ? 3 : 6,
    h: type === 'kpi' ? 3 : 4,
    minW: 3,
    minH: 2,
    widgetType: type,
    title: definition.title,
  };
}

export function encodeLayout(widgets: WidgetItem[]) {
  return encodeURIComponent(JSON.stringify(widgets));
}

export function decodeLayout(value: string | null): WidgetItem[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as WidgetItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
