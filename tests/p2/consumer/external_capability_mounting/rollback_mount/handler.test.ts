import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/rollback_mount/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("rollback_mount materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({ active_mount: {
  mount_hash: `sha256:${"a".repeat(64)}`,
  status: "ACTIVE",
  verified_publication: { verified: true },
}, rollback_target_mount: {
  mount_hash: `sha256:${"b".repeat(64)}`,
  status: "INACTIVE",
  verified_publication: { verified: true },
} }));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("rollback_mount fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ active_mount: { status: "INACTIVE" }, rollback_target_mount: {} })),
    (error: unknown) => error instanceof P2StableError,
  );
});
