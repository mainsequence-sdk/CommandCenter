# Connection Assets

Shared static assets for platform connection types live here.

## Assets

- `postgresql-logo.svg`: PostgreSQL elephant logo used by the PostgreSQL connection type. Source:
  PostgreSQL wiki logo page. Use is subject to the PostgreSQL trademark policy.
- `fred-economic-data-logo.svg`: compact FRED Economic Data icon used by the FRED connection type.
- `massive-icon-logo.svg`: icon exported from Massive-provided assets for the Massive Market Data connection.
- `duck-db-logo.png`: DuckDB logo reused by connection-adjacent Main Sequence registry views such as
  physical data sources.
- `timescale-logo.png`: Timescale logo used by the TimescaleDB connection type and reused by
  connection-adjacent Main Sequence registry views such as physical data sources.

## Maintenance Constraints

- Keep assets here only when they are reused by the shared Connections app or generic connection
  components.
- Prefer SVG for connector logos so Add New, Data Sources, and picker surfaces stay crisp at small
  sizes.
