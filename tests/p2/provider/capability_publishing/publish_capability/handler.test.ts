import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/capability_publishing/publish_capability/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

const publication_artifact_binding = {
  artifact_ref: "artifact://implementation",
  content_hash: `sha256:${"c".repeat(64)}`,
  entry_symbol_ref: "entry",
  immutable: true,
  provider_neutral_locator_binding: { locator_ref: "q-storage://implementation" },
};

test("publish_capability carries the immutable V0119 executable artifact binding", async () => {
  const response = await handler(baseRequest({
    material_set: {
      publication_eligible: true,
      capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
      capability_contract_hash: `sha256:${"a".repeat(64)}`,
      material_set_hash: `sha256:${"b".repeat(64)}`,
      provider_lineage: ["Q.EXAMPLE.CONTRACT.DOMAIN@V0100"],
      dependency_closure: [],
    },
    publication_artifact_binding,
  }));

  assert.equal(response.outcome_type, "response");
  const publication = response.runtime_result.publication as Record<string, unknown>;
  assert.deepEqual(publication.publication_artifact_binding, publication_artifact_binding);
  assert.equal(publication.implementation_material_binding, undefined);
  assert.match(String(publication.publication_hash), /^sha256:[0-9a-f]{64}$/);
});

test("publish_capability fails closed without immutable executable artifact material", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      material_set: {
        publication_eligible: true,
        capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
        capability_contract_hash: `sha256:${"a".repeat(64)}`,
        material_set_hash: `sha256:${"b".repeat(64)}`,
      },
      publication_artifact_binding: { immutable: false },
    })),
    (error: unknown) => error instanceof P2StableError,
  );
});
