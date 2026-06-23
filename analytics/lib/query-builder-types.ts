export const DIMENSIONS = ['Date', 'Location', 'Category'] as const;
export const METRICS = ['Count', 'Average', 'Sum'] as const;
export const FILTER_OPS = ['Greater than', 'Less than', 'Equals'] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type Metric = (typeof METRICS)[number];
export type FilterOp = (typeof FILTER_OPS)[number];

export interface QueryFilter {
  id: number;
  dimension: Dimension;
  op: FilterOp;
  value: string;
}

export interface SavedQuery {
  id: number;
  name: string;
  dimensions: Dimension[];
  metrics: Metric[];
  filters: QueryFilter[];
}

export interface QueryBuilderProps {
  onRun?: (dimensions: Dimension[], metrics: Metric[], filters: QueryFilter[]) => void;
  onSave?: (query: SavedQuery) => void;
  savedQueries?: SavedQuery[];
  onLoadQuery?: (query: SavedQuery) => void;
}
