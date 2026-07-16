import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectAnomalies,
  rollingAverage,
  rollingZScores,
  runAnomalyDetection,
} from './anomaly';
import {
  computeIsolationForestScores,
  runAnomalyWorker,
  type AnomalySeriesFixture,
} from '../workers/anomaly-worker';

const fixturePath = resolve(__dirname, '../fixtures/anomaly-series.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as AnomalySeriesFixture;

describe('rolling z-score anomaly detection', () => {
  it('computes rolling average with simple-statistics', () => {
    expect(rollingAverage([10, 20, 30])).toBe(20);
  });

  it('flags the injected spike in the test fixture', () => {
    const anomalies = detectAnomalies(fixture.chartId, fixture.labels, fixture.values);
    const injected = anomalies.find((a) => a.label === fixture.injectedAnomalyLabel);

    expect(injected).toBeDefined();
    expect(injected?.severity).toBe('critical');
    expect(injected?.direction).toBe('spike');
    expect(injected?.zScore).toBeDefined();
    expect(Math.abs(injected!.zScore!)).toBeGreaterThanOrEqual(2);
  });

  it('returns higher z-scores at the injected index than baseline points', () => {
    const scores = rollingZScores(fixture.values, 7);
    const injectedScore = Math.abs(scores[fixture.injectedAnomalyIndex!] ?? 0);
    const baselineScores = scores
      .slice(0, fixture.injectedAnomalyIndex)
      .filter((score): score is number => score !== null)
      .map(Math.abs);

    expect(injectedScore).toBeGreaterThan(Math.max(...baselineScores, 0));
  });
});

describe('isolation forest server-side scoring', () => {
  it('assigns a high isolation score to the injected anomaly', () => {
    const scores = computeIsolationForestScores(fixture.values);
    const injectedScore = scores[fixture.injectedAnomalyIndex!];

    expect(injectedScore).toBeGreaterThan(0.55);
  });

  it('detects the injected anomaly when z-score and isolation forest are combined', () => {
    const isolationScores = computeIsolationForestScores(fixture.values);
    const { anomalies, metrics, alerts } = runAnomalyDetection(
      fixture.chartId,
      fixture.labels,
      fixture.values,
      { isolationScores },
    );

    expect(anomalies.some((a) => a.label === fixture.injectedAnomalyLabel)).toBe(true);
    expect(metrics[0].anomalyCount).toBeGreaterThan(0);
    expect(alerts.some((a) => a.label === fixture.injectedAnomalyLabel)).toBe(true);
    expect(metrics[0].isolationForestHits).toBeGreaterThan(0);
  });
});

describe('anomaly worker', () => {
  it('emits metric and alert events and flags the injected anomaly', () => {
    const output = runAnomalyWorker({ fixturePath });

    expect(output.injectedAnomalyDetected).toBe(true);
    expect(output.events.some((e) => e.type === 'anomaly_metric')).toBe(true);
    expect(output.events.some((e) => e.type === 'anomaly_alert')).toBe(true);
    expect(output.result.anomalies.length).toBeGreaterThan(0);
  });
});
