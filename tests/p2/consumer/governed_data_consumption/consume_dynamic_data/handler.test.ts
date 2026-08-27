import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/governed_data_consumption/consume_dynamic_data/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("consume_dynamic_data materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({ governed_data_material: {
  data_category: "DYNAMIC",
  source_domain_identity: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  subject_identity: "subject-1",
  source_revision: "rev-1", selection_hash: `sha256:${"d".repeat(64)}`,
  source_provenance: { source: "provider" },
  source_fact_authority: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  governed_access_binding: { authorization_ref: "auth-1" },
  integrity_binding: { hash: `sha256:${"e".repeat(64)}` },
}, verification: { integrity_verified: true } }));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("consume_dynamic_data fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ governed_data_material: { data_category: "WRONG" }, verification: { integrity_verified: false } })),
    (error: unknown) => error instanceof P2StableError,
  );
});
