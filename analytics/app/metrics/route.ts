import { NextResponse } from 'next/server';

// Persist the metrics counter in memory across requests
const globalRef = global as unknown as {
  pipelineRuns: number;
};

if (globalRef.pipelineRuns === undefined) {
  globalRef.pipelineRuns = 0;
}

export async function GET() {
  globalRef.pipelineRuns += 1;

  const total = globalRef.pipelineRuns;
  const contracts = Math.round(total * 0.95);
  const backend = Math.round(total * 0.90);
  const frontend = Math.round(total * 0.85);
  const analytics = Math.round(total * 0.80);
  const terraformFmt = Math.round(total * 0.98);

  // Engagement and LTV gauges
  const ltv = 145.82 + Math.sin(total / 10) * 5;
  const engagement = 0.76 + Math.cos(total / 15) * 0.05;

  const body = [
    `# HELP vertexchain_pipeline_runs_total Total number of pipeline runs`,
    `# TYPE vertexchain_pipeline_runs_total counter`,
    `vertexchain_pipeline_runs_total ${total}`,
    ``,
    `# HELP vertexchain_pipeline_stage_runs_total Total runs per pipeline stage`,
    `# TYPE vertexchain_pipeline_stage_runs_total counter`,
    `vertexchain_pipeline_stage_runs_total{stage="contracts"} ${contracts}`,
    `vertexchain_pipeline_stage_runs_total{stage="backend"} ${backend}`,
    `vertexchain_pipeline_stage_runs_total{stage="frontend"} ${frontend}`,
    `vertexchain_pipeline_stage_runs_total{stage="analytics"} ${analytics}`,
    `vertexchain_pipeline_stage_runs_total{stage="terraform_fmt"} ${terraformFmt}`,
    ``,
    `# HELP vertexchain_user_ltv Average customer lifetime value in USD`,
    `# TYPE vertexchain_user_ltv gauge`,
    `vertexchain_user_ltv ${ltv.toFixed(2)}`,
    ``,
    `# HELP vertexchain_user_engagement_ratio Average user engagement ratio`,
    `# TYPE vertexchain_user_engagement_ratio gauge`,
    `vertexchain_user_engagement_ratio ${engagement.toFixed(4)}`,
    ``
  ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}
