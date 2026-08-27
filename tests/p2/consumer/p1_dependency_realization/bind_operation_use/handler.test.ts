import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/p1_dependency_realization/bind_operation_use/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("bind_operation_use materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({ dependency_realization_binding: {
  binding_hash: `sha256:${"a".repeat(64)}`,
  exact_receiving_operation_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/operations/run",
  exact_local_dependency_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/dependencies/provider_search",
}, operation_use: {
  exact_receiving_operation_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/operations/run",
  exact_local_dependency_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/dependencies/provider_search",
} }));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("bind_operation_use fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ dependency_realization_binding: {
  binding_hash: `sha256:${"a".repeat(64)}`,
  exact_receiving_operation_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/operations/run",
  exact_local_dependency_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/dependencies/provider_search",
}, operation_use: { exact_receiving_operation_ref: "other", exact_local_dependency_ref: "other" } })),
    (error: unknown) => error instanceof P2StableError,
  );
});
