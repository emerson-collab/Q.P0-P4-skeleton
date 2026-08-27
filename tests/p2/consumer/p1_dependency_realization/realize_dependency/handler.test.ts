import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/p1_dependency_realization/realize_dependency/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("realize_dependency materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({ verified_provider_binding_or_governed_data_binding: { kind: "ACTIVE_MOUNT", active: true, binding_hash: `sha256:${"a".repeat(64)}` }, receiving_p1_binding: {
  exact_owner_capability_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100",
  exact_receiving_operation_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/operations/run",
  exact_local_dependency_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/dependencies/provider_search",
} }));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("realize_dependency fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ verified_provider_binding_or_governed_data_binding: { kind: "ACTIVE_MOUNT", active: true, binding_hash: `sha256:${"a".repeat(64)}` }, receiving_p1_binding: {
  exact_owner_capability_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100",
  exact_receiving_operation_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/operations/run",
  exact_local_dependency_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.SEARCH@V0100#/dependencies/provider_search",
}, create_p1_dependency: true })),
    (error: unknown) => error instanceof P2StableError,
  );
});
