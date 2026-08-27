import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/governed_data_exposure/expose_runtime_data/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("expose_runtime_data materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({
  source_domain_identity: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  subject_identity: "subject-1",
  source_revision: "exec-1",
  source_provenance: { source: "execution_receipt" },
  source_fact_authority: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  governed_access_binding: { authorization_ref: "auth-1" },
  integrity_binding: { receipt_hash: `sha256:${"c".repeat(64)}` },
  runtime_facts: [{ outcome_type: "response" }],
}));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("expose_runtime_data fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ reexecution_requested: true })),
    (error: unknown) => error instanceof P2StableError,
  );
});
