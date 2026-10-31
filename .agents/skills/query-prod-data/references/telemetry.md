# Telemetry (load_timing only)

Source: `packages/api-worker/src/features/admin/analyticsQueries.ts`, specifically the load-timing query builder `createLoadTimingAnalyticsQuery`. Only the fields that builder uses are documented here. Every other field meaning is unverified and omitted.

## Code-supported fields

The builder selects, from the `load_timing` dataset:

| Field     | Meaning as used in code                                             |
| --------- | ------------------------------------------------------------------- |
| `blob3`   | Country                                                             |
| `blob4`   | Colo (edge node)                                                    |
| `blob5`   | ISP / organisation name                                             |
| `double1` | Load duration in milliseconds (averaged with sample weighting)      |
| `double7` | Time to first byte in milliseconds (averaged with sample weighting) |

The builder groups by country, colo, and ISP, and weights each average by the `_sample_interval` sample weight:

```sql
SELECT
  blob3 as country,
  blob4 as colo,
  blob5 as isp,
  SUM(_sample_interval) as cnt,
  SUM(_sample_interval * double1) / SUM(_sample_interval) as avg_load_ms,
  SUM(_sample_interval * double7) / SUM(_sample_interval) as avg_ttfb_ms
FROM load_timing
WHERE timestamp >= toDateTime('{START_UTC}') AND timestamp < toDateTime('{END_UTC}')
GROUP BY country, colo, isp
ORDER BY cnt DESC
```

Use this shape. Do not replace the sample-weighted averages with unweighted averages, and do not add grouping columns from unverified fields. Timestamps in the query are UTC datetimes; state the range and the timezone in the report.

## Unverified and omitted

The previous version of this skill listed meanings for `index1`, `blob1`, `blob2`, `double2` through `double6`, and `double8` through `double10`, plus a data-retention period. None of those meanings, and no retention period, appears in the deciding code read for this rewrite. They are listed here only as unverified and omitted: do not name them in a query, do not state their meanings, and do not state a retention period. If a question needs one of them, read the telemetry writing code that populates the dataset first, and only then document the field with that source cited.

A second query builder exists in the same file for a different dataset. Its field meanings are not documented by this skill; do not copy its field list into a `load_timing` query, and do not document it without reading its builder and the code that writes to that dataset.

## Request method

Query the telemetry API only through the operator's own authenticated request method, following the tool's own documentation. This skill gives no request template that embeds a credential: no token-extraction command, no credential file path, and no account identifier. If the operator's authenticated method is unavailable, stop and report that. Never work around authentication by reading a credential file.

## What is not documented here

- Any telemetry dataset beyond `load_timing`.
- Any field beyond `blob3`, `blob4`, `blob5`, `double1`, and `double7` for `load_timing`.
- Any retention period, sampling rate beyond the `_sample_interval` weighting shown above, or cost or quota claim. None was verified.
