import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { AnomalyWorkerOutput } from '../workers/anomaly-worker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturePath = resolve(__dirname, '../fixtures/anomaly-series.json');
const workerPath = resolve(__dirname, '../workers/anomaly-worker.ts');

const worker = new Worker(workerPath, {
  workerData: { fixturePath },
  execArgv: ['--import', 'tsx'],
});

worker.on('message', (output: AnomalyWorkerOutput) => {
  if (!output.injectedAnomalyDetected) {
    console.error('Anomaly worker failed: injected anomaly was not flagged.');
    process.exitCode = 1;
    return;
  }

  console.error(
    `Anomaly worker complete: ${output.result.anomalies.length} anomal${output.result.anomalies.length === 1 ? 'y' : 'ies'} detected.`,
  );
});

worker.on('error', (error) => {
  console.error('Anomaly worker error:', error);
  process.exitCode = 1;
});

worker.on('exit', (code) => {
  if (code !== 0 && process.exitCode === undefined) {
    process.exitCode = code ?? 1;
  }
});
