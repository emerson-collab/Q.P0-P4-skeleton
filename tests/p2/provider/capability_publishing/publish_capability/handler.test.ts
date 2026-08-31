import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/capability_publishing/publish_capability/handler.ts";

const ARTIFACT_BYTES = "provider-artifact";
const ARTIFACT_HASH = "sha256:80b9d532c16b0d2bc50b18bbc1b4126653fda1ee731b7c2dcc4922afde2470e5" as const;

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

const materialSet = Object.freeze({
  publication_eligible: true,
  capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
  capability_contract_hash: `sha256:${"a".repeat(64)}`,
  material_set_hash: `sha256:${"b".repeat(64)}`,
  provider_lineage: ["Q.EXAMPLE.CONTRACT.DOMAIN@V0100"],
  dependency_closure: [],
});

const executableBinding = Object.freeze({
  artifact_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100#/physical_model",
  content_hash: ARTIFACT_HASH,
  provider_neutral_locator_binding: Object.freeze({ material_path: "export/search/entry.ts" }),
  entry_symbol_ref: "export/search/entry.ts#entry",
});

test("publish_capability publishes exact executable V0117 material after readback verification", async () => {
  assert.equal(STAGE_CONTRACT_REF, "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0117");
  const response = await handler(baseRequest({
    material_set: materialSet,
    publication_artifact_binding: executableBinding,
  }), {
    async readback_committed_artifact(input) {
      assert.equal(input.artifact_ref, executableBinding.artifact_ref);
      assert.deepEqual(input.provider_neutral_locator_binding, executableBinding.provider_neutral_locator_binding);
      assert.equal(input.entry_symbol_ref, executableBinding.entry_symbol_ref);
      return ARTIFACT_BYTES;
    },
  });

  const publication = response.runtime_result.publication as Readonly<Record<string, unknown>>;
  const binding = publication.publication_artifact_binding as Readonly<Record<string, unknown>>;
  assert.equal(response.outcome_type, "response");
  assert.equal(publication.immutable, true);
  assert.equal(binding.artifact_ref, executableBinding.artifact_ref);
  assert.equal(binding.content_hash, ARTIFACT_HASH);
  assert.equal(binding.entry_symbol_ref, executableBinding.entry_symbol_ref);
  assert.match(String(publication.publication_hash), /^sha256:[0-9a-f]{64}$/);
});

test("publish_capability fails closed on hash-mismatched committed executable material", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      material_set: materialSet,
      publication_artifact_binding: executableBinding,
    }), {
      async readback_committed_artifact() { return "wrong-bytes"; },
    }),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_INTEGRITY_BINDING_INVALID",
  );
});
