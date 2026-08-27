import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/governed_data_exposure/expose_dynamic_data/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("expose_dynamic_data materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({
  source_domain_identity: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  subject_identity: "subject-1",
  source_revision: "rev-1",
  selection_hash: `sha256:${"d".repeat(64)}`,
  source_provenance: { source: "governed_registry" },
  source_fact_authority: "Q.EXAMPLE.CONTRACT.DOMAIN@V0100",
  governed_access_binding: { authorization_ref: "auth-1" },
  integrity_binding: { manifest_hash: `sha256:${"e".repeat(64)}` },
  mode: "ARTIFACT_CHUNKED_SNAPSHOT",
  artifact_chunked_snapshot: {
    manifest: { source_revision: "rev-1", selection_hash: `sha256:${"d".repeat(64)}` },
    chunks: [{ source_revision: "rev-1", selection_hash: `sha256:${"d".repeat(64)}`, content_hash: `sha256:${"f".repeat(64)}` }],
  },
}));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("expose_dynamic_data fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({
  source_domain_identity: "x", subject_identity: "s", source_revision: "r1", selection_hash: `sha256:${"a".repeat(64)}`,
  source_provenance: {}, source_fact_authority: "a", governed_access_binding: {}, integrity_binding: {},
  mode: "ARTIFACT_CHUNKED_SNAPSHOT",
  artifact_chunked_snapshot: { manifest: { source_revision: "r2", selection_hash: `sha256:${"a".repeat(64)}` }, chunks: [] }
})),
    (error: unknown) => error instanceof P2StableError,
  );
});
