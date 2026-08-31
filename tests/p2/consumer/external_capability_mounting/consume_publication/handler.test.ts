import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/consume_publication/handler.ts";

const ARTIFACT_BYTES = "provider-artifact";
const ARTIFACT_HASH = "sha256:80b9d532c16b0d2bc50b18bbc1b4126653fda1ee731b7c2dcc4922afde2470e5" as const;
const PUBLICATION_HASH = `sha256:${"b".repeat(64)}` as const;

const publication = Object.freeze({
  immutable: true,
  capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
  capability_contract_hash: `sha256:${"a".repeat(64)}`,
  publication_hash: PUBLICATION_HASH,
  publication_artifact_binding: Object.freeze({
    artifact_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100#/physical_model",
    content_hash: ARTIFACT_HASH,
    provider_neutral_locator_binding: Object.freeze({ material_path: "export/search/entry.ts" }),
    entry_symbol_ref: "export/search/entry.ts#entry",
  }),
});

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("consume_publication verifies executable material and creates V0117 resolver_state", async () => {
  assert.equal(STAGE_CONTRACT_REF, "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0117");

  const response = await handler(baseRequest({
    publication,
    verification: { integrity_verified: true },
  }), {
    async resolve_implementation_artifact(input) {
      assert.equal(input.artifact_ref, publication.publication_artifact_binding.artifact_ref);
      assert.deepEqual(input.provider_neutral_locator_binding, publication.publication_artifact_binding.provider_neutral_locator_binding);
      assert.equal(input.entry_symbol_ref, publication.publication_artifact_binding.entry_symbol_ref);
      return {
        artifact_bytes: ARTIFACT_BYTES,
        local_material_binding_ref: "local-material:search-v0100",
      };
    },
  });

  const verified = response.runtime_result.verified_publication as Readonly<Record<string, unknown>>;
  const resolverState = verified.resolver_state as Readonly<Record<string, unknown>>;
  assert.equal(response.outcome_type, "response");
  assert.equal(verified.verified, true);
  assert.equal(resolverState.publication_hash, PUBLICATION_HASH);
  assert.equal(resolverState.implementation_artifact_hash, ARTIFACT_HASH);
  assert.deepEqual(resolverState.provider_neutral_locator_binding, publication.publication_artifact_binding.provider_neutral_locator_binding);
  assert.equal(resolverState.entry_symbol_ref, publication.publication_artifact_binding.entry_symbol_ref);
  assert.equal(resolverState.local_material_binding_ref, "local-material:search-v0100");
  assert.equal(resolverState.verified, true);
  assert.match(String(resolverState.binding_hash), /^sha256:[0-9a-f]{64}$/);
});

test("consume_publication fails closed on hash-mismatched executable material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ publication, verification: { integrity_verified: true } }), {
      async resolve_implementation_artifact() {
        return { artifact_bytes: "wrong-bytes", local_material_binding_ref: "local-material:bad" };
      },
    }),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_INTEGRITY_BINDING_INVALID",
  );
});
