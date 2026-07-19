export {
  buildAnomalyAlerts,
  buildAnomalyMetric,
  detectAnomalies,
  rollingAverage,
  rollingZScores,
  runAnomalyDetection,
} from '@/lib/anomaly';
export type {
  Anomaly,
  AnomalyAlert,
  AnomalyDetectionOptions,
  AnomalyDetectionResult,
  AnomalyMetric,
  AnomalyMethod,
  AnomalySeverity,
} from '@/lib/anomaly';
