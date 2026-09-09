import type { InstancePersistenceBinding } from "../../src/p1/business_runtime/persistence_schema_compiler.ts";
import type {
  CatalogProjectionRow,
  RelationalSchemaExecutor,
  RelationalSchemaTransaction,
} from "../../src/p1/business_runtime/persistence_schema_apply.ts";

export interface PostgresqlQueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface PostgresqlSession {
  query(sql: string, parameters?: readonly unknown[]): Promise<PostgresqlQueryResult>;
}

export interface PostgresqlSessionProvider {
  readonly database_instance_ref: string;
  withSession<T>(fn: (session: PostgresqlSession) => Promise<T>): Promise<T>;
}

export class PersistenceRuntimeBindingError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PersistenceRuntimeBindingError";
    this.code = code;
  }
}

function exactString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PersistenceRuntimeBindingError("P1_RUNTIME_DATABASE_CATALOG_INVALID", `${field} must be a non-empty string`);
  }
  return value;
}

function ordinal(value: unknown): number {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new PersistenceRuntimeBindingError("P1_RUNTIME_DATABASE_CATALOG_INVALID", "ordinal_position must be a positive integer");
  }
  return numberValue;
}

function nullable(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "YES") return true;
  if (value === "NO") return false;
  throw new PersistenceRuntimeBindingError("P1_RUNTIME_DATABASE_CATALOG_INVALID", "is_nullable must be boolean or YES/NO");
}

function normalizeDataType(value: unknown): string {
  const type = exactString(value, "data_type");
  if (type === "timestamp with time zone") return "timestamptz";
  return type;
}

async function readCatalogProjection(
  session: PostgresqlSession,
  schemaName: string,
): Promise<readonly CatalogProjectionRow[]> {
  const result = await session.query(
    `SELECT c.table_schema AS schema_name,
            c.table_name AS object_name,
            c.column_name AS column_name,
            c.ordinal_position AS ordinal_position,
            c.data_type AS data_type,
            c.is_nullable AS is_nullable
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
      WHERE c.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position`,
    [schemaName],
  );

  return Object.freeze(result.rows.map((row) => Object.freeze({
    schema_name: exactString(row.schema_name, "schema_name"),
    object_kind: "TABLE" as const,
    object_name: exactString(row.object_name, "object_name"),
    column_name: exactString(row.column_name, "column_name"),
    ordinal_position: ordinal(row.ordinal_position),
    data_type: normalizeDataType(row.data_type),
    is_nullable: nullable(row.is_nullable),
  })));
}

export function createPostgresqlRelationalSchemaExecutor(
  binding: Readonly<InstancePersistenceBinding>,
  provider: PostgresqlSessionProvider,
): RelationalSchemaExecutor {
  if (binding.dialect !== "postgresql") {
    throw new PersistenceRuntimeBindingError("P1_RUNTIME_DATABASE_DIALECT_UNSUPPORTED", "runtime persistence binding requires postgresql dialect");
  }
  if (provider.database_instance_ref !== binding.database_instance_ref) {
    throw new PersistenceRuntimeBindingError(
      "P1_RUNTIME_DATABASE_INSTANCE_MISMATCH",
      "PostgreSQL session provider database_instance_ref does not match exact instance persistence binding",
    );
  }

  const assertSchema = (schemaName: string): void => {
    if (schemaName !== binding.schema_name) {
      throw new PersistenceRuntimeBindingError(
        "P1_RUNTIME_DATABASE_SCHEMA_MISMATCH",
        "catalog request schema_name does not match exact instance persistence binding",
      );
    }
  };

  return Object.freeze({
    database_instance_ref: binding.database_instance_ref,
    dialect: "postgresql" as const,
    async catalogProjection(schemaName: string): Promise<readonly CatalogProjectionRow[]> {
      assertSchema(schemaName);
      return provider.withSession((session) => readCatalogProjection(session, schemaName));
    },
    async transaction<T>(fn: (tx: RelationalSchemaTransaction) => Promise<T>): Promise<T> {
      return provider.withSession(async (session) => {
        await session.query("BEGIN");
        try {
          const tx: RelationalSchemaTransaction = Object.freeze({
            async execute(statement: string): Promise<void> {
              await session.query(statement);
            },
            async catalogProjection(schemaName: string): Promise<readonly CatalogProjectionRow[]> {
              assertSchema(schemaName);
              return readCatalogProjection(session, schemaName);
            },
          });
          const result = await fn(tx);
          await session.query("COMMIT");
          return result;
        } catch (error) {
          try {
            await session.query("ROLLBACK");
          } catch {
            // Preserve the original transaction failure.
          }
          throw error;
        }
      });
    },
  });
}
