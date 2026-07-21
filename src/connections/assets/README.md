# Connection Assets

Shared static assets for platform connection types live here.

## Assets

- `postgresql-logo.svg`: PostgreSQL elephant logo used by the PostgreSQL connection type. Source:
  PostgreSQL wiki logo page. Use is subject to the PostgreSQL trademark policy.
- `mysql-logo.svg`: MySQL brand glyph used by the MySQL connection type. Source: Simple Icons
  MySQL SVG, downloaded from `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/mysql.svg`.
- `python-logo.svg`: Python brand glyph reserved for Python runtime and adapter surfaces. Source:
  Simple Icons Python SVG, downloaded from
  `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/python.svg`.
- `nodejs-logo.svg`: Node.js brand glyph reserved for Node.js runtime and adapter surfaces. Source:
  Simple Icons Node.js SVG, downloaded from
  `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/nodedotjs.svg`.
- `mssql-logo.svg`: Microsoft SQL Server 2025 icon used by the `mssql.database` connection type.
  Source: Microsoft SQL Server product icon, mirrored by Wikimedia Commons from
  `https://www.microsoft.com/en-us/sql-server`; copyright status is listed as public domain for
  simple geometry, but Microsoft trademark restrictions may still apply.
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
