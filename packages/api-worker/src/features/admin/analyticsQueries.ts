/** Sampling-aware Analytics Engine SQL builders for existing Admin telemetry views. */

function toAnalyticsDateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Build the load-timing aggregation query with Analytics Engine sample weights. */
export function createLoadTimingAnalyticsQuery(fromDate: Date, toDate: Date): string {
  const analyticsFrom = toAnalyticsDateTime(fromDate);
  const analyticsTo = toAnalyticsDateTime(toDate);
  return `
    SELECT
      blob3 as country,
      blob4 as colo,
      blob5 as isp,
      SUM(_sample_interval) as cnt,
      SUM(_sample_interval * double1) / SUM(_sample_interval) as avg_load_ms,
      SUM(_sample_interval * double7) / SUM(_sample_interval) as avg_ttfb_ms
    FROM load_timing
    WHERE timestamp >= toDateTime('${analyticsFrom}') AND timestamp < toDateTime('${analyticsTo}')
    GROUP BY country, colo, isp
    ORDER BY cnt DESC
  `;
}

/** Build the AI-usage aggregation query with Analytics Engine sample weights. */
export function createAIUsageAnalyticsQuery(fromDate: Date, toDate: Date): string {
  const analyticsFrom = toAnalyticsDateTime(fromDate);
  const analyticsTo = toAnalyticsDateTime(toDate);
  return `
    SELECT
      blob1 as userId,
      blob2 as model,
      blob3 as provider,
      blob4 as country,
      blob5 as status,
      SUM(_sample_interval) as cnt,
      SUM(_sample_interval * double1) / SUM(_sample_interval) as avgTtfrMs
    FROM ai_usage
    WHERE timestamp >= toDateTime('${analyticsFrom}') AND timestamp < toDateTime('${analyticsTo}')
    GROUP BY userId, model, provider, country, status
    ORDER BY cnt DESC
  `;
}
