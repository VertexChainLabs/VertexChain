import { mean, standardDeviation, zScore } from 'simple-statistics';

export type AnomalySeverity = 'warning' | 'critical';
export type AnomalyMethod = 'z-score' | 'isolation-forest' | 'combined';

export interface Anomaly {
  chartId: string;
  label: string;
  current: number;
  average: number;
  pctChange: number;
  severity: AnomalySeverity;
  direction: 'spike' | 'drop';
  zScore?: number;
  isolationScore?: number;
  method?: AnomalyMethod;
}

export interface AnomalyDetectionOptions {
  /** Rolling window size for z-score (default 7). */
  windowSize?: number;
  /** |z| at or above this value is a warning (default 2). */
  zWarning?: number;
  /** |z| at or above this value is critical (default 3). */
  zCritical?: number;
  /** Isolation forest score threshold (default 0.65). */
  isolationThreshold?: number;
  /** Pre-computed isolation forest scores (server-side worker only). */
  isolationScores?: number[];
}

export interface AnomalyMetric {
  type: 'anomaly_metric';
  chartId: string;
  totalPoints: number;
  anomalyCount: number;
  zScoreHits: number;
  isolationForestHits: number;
  timestamp: string;
}

export interface AnomalyAlert {
  type: 'anomaly_alert';
  chartId: string;
  label: string;
  severity: AnomalySeverity;
  message: string;
  value: number;
  zScore?: number;
  isolationScore?: number;
  method: AnomalyMethod;
  timestamp: string;
}

const DEFAULT_WINDOW = 7;
const DEFAULT_Z_WARNING = 2;
const DEFAULT_Z_CRITICAL = 3;
const DEFAULT_ISOLATION_THRESHOLD = 0.65;

/** Compute rolling average of an array. */
export function rollingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return mean(values);
}

/** Rolling z-scores using a trailing window of prior points and simple-statistics. */
export function rollingZScores(values: number[], windowSize = DEFAULT_WINDOW): (number | null)[] {
  return values.map((value, index) => {
    const end = index;
    const start = Math.max(0, end - windowSize);
    const window = values.slice(start, end);
    if (window.length < 2) return null;

    const windowMean = mean(window);
    const std = standardDeviation(window);
    if (std === 0) return 0;

    return zScore(value, windowMean, std);
  });
}

function severityFromSignals(
  absZ: number,
  iso: number | undefined,
  zWarning: number,
  zCritical: number,
  isolationThreshold: number,
): AnomalySeverity | null {
  const zHit = absZ >= zWarning;
  const isoHit = iso !== undefined && iso >= isolationThreshold;
  if (!zHit && !isoHit) return null;

  if (absZ >= zCritical || (iso !== undefined && iso >= 0.8)) return 'critical';
  return 'warning';
}

/**
 * Detect anomalies using rolling z-score and optional isolation-forest scores.
 * Z-score: |z| >= 2 warning, |z| >= 3 critical.
 * Isolation forest scores are supplied by the server worker when available.
 */
export function detectAnomalies(
  chartId: string,
  labels: string[],
  values: number[],
  options: AnomalyDetectionOptions = {},
): Anomaly[] {
  const {
    windowSize = DEFAULT_WINDOW,
    zWarning = DEFAULT_Z_WARNING,
    zCritical = DEFAULT_Z_CRITICAL,
    isolationThreshold = DEFAULT_ISOLATION_THRESHOLD,
    isolationScores,
  } = options;

  const avg = rollingAverage(values);
  const zScores = rollingZScores(values, windowSize);

  return values.flatMap((value, index) => {
    const z = zScores[index];
    const iso = isolationScores?.[index];
    const absZ = z !== null ? Math.abs(z) : 0;

    const severity = severityFromSignals(
      absZ,
      iso,
      zWarning,
      zCritical,
      isolationThreshold,
    );
    if (!severity) return [];

    const zHit = z !== null && absZ >= zWarning;
    const isoHit = iso !== undefined && iso >= isolationThreshold;
    const method: AnomalyMethod =
      zHit && isoHit ? 'combined' : zHit ? 'z-score' : 'isolation-forest';

    const pct = avg === 0 ? 0 : ((value - avg) / avg) * 100;

    return [
      {
        chartId,
        label: labels[index] ?? `Point ${index}`,
        current: value,
        average: Math.round(avg),
        pctChange: Math.round(pct * 10) / 10,
        severity,
        direction: pct >= 0 ? 'spike' : 'drop',
        zScore: z !== null ? Math.round(z * 100) / 100 : undefined,
        isolationScore: iso !== undefined ? Math.round(iso * 1000) / 1000 : undefined,
        method,
      },
    ];
  });
}

export function buildAnomalyMetric(
  chartId: string,
  values: number[],
  anomalies: Anomaly[],
): AnomalyMetric {
  return {
    type: 'anomaly_metric',
    chartId,
    totalPoints: values.length,
    anomalyCount: anomalies.length,
    zScoreHits: anomalies.filter((a) => a.method === 'z-score' || a.method === 'combined').length,
    isolationForestHits: anomalies.filter(
      (a) => a.method === 'isolation-forest' || a.method === 'combined',
    ).length,
    timestamp: new Date().toISOString(),
  };
}

export function buildAnomalyAlerts(anomalies: Anomaly[]): AnomalyAlert[] {
  const timestamp = new Date().toISOString();

  return anomalies.map((anomaly) => ({
    type: 'anomaly_alert',
    chartId: anomaly.chartId,
    label: anomaly.label,
    severity: anomaly.severity,
    message: `${anomaly.direction === 'spike' ? 'Spike' : 'Drop'} detected at ${anomaly.label} via ${anomaly.method ?? 'z-score'}`,
    value: anomaly.current,
    zScore: anomaly.zScore,
    isolationScore: anomaly.isolationScore,
    method: anomaly.method ?? 'z-score',
    timestamp,
  }));
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  metrics: AnomalyMetric[];
  alerts: AnomalyAlert[];
}

/** Run detection and produce metric + alert payloads for the worker. */
export function runAnomalyDetection(
  chartId: string,
  labels: string[],
  values: number[],
  options: AnomalyDetectionOptions = {},
): AnomalyDetectionResult {
  const anomalies = detectAnomalies(chartId, labels, values, options);

  return {
    anomalies,
    metrics: [buildAnomalyMetric(chartId, values, anomalies)],
    alerts: buildAnomalyAlerts(anomalies),
  };
}
