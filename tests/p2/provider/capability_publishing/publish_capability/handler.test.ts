import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/capability_publishing/publish_capability/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("publish_capability materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({
  material_set: {
    publication_eligible: true,
    capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
    capability_contract_hash: `sha256:${"a".repeat(64)}`,
    material_set_hash: `sha256:${"b".repeat(64)}`,
    provider_lineage: ["Q.EXAMPLE.CONTRACT.DOMAIN@V0100"],
    dependency_closure: [],
  },
  publication_artifact_binding: { artifact_ref: "artifact://publication" },
}));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("publish_capability fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ material_set: { publication_eligible: false }, publication_artifact_binding: {} })),
    (error: unknown) => error instanceof P2StableError,
  );
});
