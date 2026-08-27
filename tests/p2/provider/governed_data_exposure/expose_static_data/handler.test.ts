import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/governed_data_exposure/expose_static_data/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("expose_static_data materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({
  source_domain_identity: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  subject_identity: "subject-1",
  source_revision: "rev-1",
  source_provenance: { source: "declared_q_interface" },
  source_fact_authority: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  governed_access_binding: { authorization_ref: "auth-1" },
  integrity_binding: { content_hash: `sha256:${"c".repeat(64)}` },
  inline_facts: [{ key: "value" }],
}));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("expose_static_data fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ source_domain_identity: "x", subject_identity: "s", source_revision: "r", source_provenance: {}, source_fact_authority: "a", governed_access_binding: {}, integrity_binding: {}, inline_facts: [], artifact_material_binding: {} })),
    (error: unknown) => error instanceof P2StableError,
  );
});
