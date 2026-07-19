import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IsolationForest } from 'isolation-forest';
import {
  runAnomalyDetection,
  type AnomalyAlert,
  type AnomalyDetectionResult,
  type AnomalyMetric,
} from '../lib/anomaly';

export interface AnomalySeriesFixture {
  chartId: string;
  labels: string[];
  values: number[];
  injectedAnomalyIndex?: number;
  injectedAnomalyLabel?: string;
}

export interface AnomalyWorkerInput {
  fixturePath?: string;
  chartId?: string;
  labels?: string[];
  values?: number[];
}

export interface AnomalyWorkerOutput {
  result: AnomalyDetectionResult;
  injectedAnomalyDetected: boolean;
  events: Array<AnomalyMetric | AnomalyAlert>;
}

/** Compute isolation-forest anomaly scores for a univariate series (server-side only). */
export function computeIsolationForestScores(values: number[]): number[] {
  if (values.length < 3) return values.map(() => 0.5);

  const samples = values.map((value, idx) => ({ value, idx }));
  const forest = new IsolationForest(50, Math.min(256, values.length));
  forest.fit(samples);
  return forest.predict(samples);
}

export function runAnomalyWorker(input: AnomalyWorkerInput): AnomalyWorkerOutput {
  let chartId: string;
  let labels: string[];
  let values: number[];
  let injectedAnomalyIndex: number | undefined;
  let injectedAnomalyLabel: string | undefined;

  if (input.fixturePath) {
    const fixture = JSON.parse(
      readFileSync(resolve(input.fixturePath), 'utf8'),
    ) as AnomalySeriesFixture;
    chartId = fixture.chartId;
    labels = fixture.labels;
    values = fixture.values;
    injectedAnomalyIndex = fixture.injectedAnomalyIndex;
    injectedAnomalyLabel = fixture.injectedAnomalyLabel;
  } else {
    chartId = input.chartId ?? 'Unknown Metric';
    labels = input.labels ?? [];
    values = input.values ?? [];
  }

  const isolationScores = computeIsolationForestScores(values);
  const result = runAnomalyDetection(chartId, labels, values, { isolationScores });

  const injectedAnomalyDetected =
    injectedAnomalyIndex === undefined
      ? result.anomalies.length > 0
      : result.anomalies.some(
          (anomaly) =>
            anomaly.label === (injectedAnomalyLabel ?? labels[injectedAnomalyIndex!]) ||
            labels[injectedAnomalyIndex!] === anomaly.label,
        );

  const events: Array<AnomalyMetric | AnomalyAlert> = [
    ...result.metrics,
    ...result.alerts,
  ];

  return { result, injectedAnomalyDetected, events };
}

function emitEvents(events: Array<AnomalyMetric | AnomalyAlert>): void {
  for (const event of events) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}

if (parentPort) {
  const output = runAnomalyWorker(workerData as AnomalyWorkerInput);
  emitEvents(output.events);
  parentPort.postMessage(output);
}
