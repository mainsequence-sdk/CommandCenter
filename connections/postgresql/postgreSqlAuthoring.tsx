import {
  SHARED_SQL_DEFAULT_AUTHORING_MAX_ROWS,
  SharedSqlConnectionAuthoringSummary,
  createSharedSqlConnectionAuthoringContract,
} from "@/connections/sql/sharedSqlAuthoring";

export const POSTGRESQL_DEFAULT_AUTHORING_MAX_ROWS = SHARED_SQL_DEFAULT_AUTHORING_MAX_ROWS;
export const PostgreSqlConnectionAuthoringSummary = SharedSqlConnectionAuthoringSummary;

export function createPostgreSqlConnectionAuthoringContract({
  providerName = "PostgreSQL",
}: {
  providerName?: string;
} = {}) {
  return createSharedSqlConnectionAuthoringContract({ providerName });
}

export const postgreSqlConnectionAuthoringContract =
  createPostgreSqlConnectionAuthoringContract();
