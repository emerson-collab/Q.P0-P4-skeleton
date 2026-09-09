import assert from "node:assert/strict";
import test from "node:test";
import {
  createPostgresqlRelationalSchemaExecutor,
  type PostgresqlSessionProvider,
} from "../../../runtime/persistence/postgresql_relational_executor.ts";

const binding = Object.freeze({
  database_instance_ref: "db.instance.test.primary",
  dialect: "postgresql" as const,
  schema_name: "q_test",
});

function provider(
  queries: string[],
  rows: readonly Readonly<Record<string, unknown>>[],
): PostgresqlSessionProvider {
  return Object.freeze({
    database_instance_ref: binding.database_instance_ref,
    async withSession<T>(fn: (session: { query(sql: string, parameters?: readonly unknown[]): Promise<{ rows: readonly Readonly<Record<string, unknown>>[] }> }) => Promise<T>): Promise<T> {
      return fn({
        async query(sql: string): Promise<{ rows: readonly Readonly<Record<string, unknown>>[] }> {
          queries.push(sql);
          return { rows: sql.includes("information_schema.columns") ? rows : [] };
        },
      });
    },
  });
}

test("PostgreSQL runtime executor preserves exact database identity and normalizes catalog projection", async () => {
  const queries: string[] = [];
  const executor = createPostgresqlRelationalSchemaExecutor(binding, provider(queries, [
    {
      schema_name: "q_test",
      object_name: "example_record",
      column_name: "q_created_at",
      ordinal_position: "3",
      data_type: "timestamp with time zone",
      is_nullable: "NO",
    },
  ]));

  assert.equal(executor.database_instance_ref, binding.database_instance_ref);
  assert.equal(executor.dialect, "postgresql");
  assert.deepEqual(await executor.catalogProjection("q_test"), [
    {
      schema_name: "q_test",
      object_kind: "TABLE",
      object_name: "example_record",
      column_name: "q_created_at",
      ordinal_position: 3,
      data_type: "timestamptz",
      is_nullable: false,
    },
  ]);
  assert.equal(queries.length, 1);
});

test("PostgreSQL runtime executor uses one explicit transaction and rolls back failures", async () => {
  const queries: string[] = [];
  const executor = createPostgresqlRelationalSchemaExecutor(binding, provider(queries, []));

  await assert.rejects(
    () => executor.transaction(async (tx) => {
      await tx.execute('CREATE TABLE "q_test"."x" ("q_ref" text);');
      throw new Error("boom");
    }),
    /boom/,
  );

  assert.equal(queries[0], "BEGIN");
  assert.match(queries[1] ?? "", /CREATE TABLE/);
  assert.equal(queries.at(-1), "ROLLBACK");
});

test("PostgreSQL runtime executor fails closed on database_instance_ref mismatch", () => {
  const mismatched: PostgresqlSessionProvider = Object.freeze({
    database_instance_ref: "db.instance.other",
    async withSession<T>(): Promise<T> {
      throw new Error("not reached");
    },
  });

  assert.throws(
    () => createPostgresqlRelationalSchemaExecutor(binding, mismatched),
    /does not match exact instance persistence binding/,
  );
});
