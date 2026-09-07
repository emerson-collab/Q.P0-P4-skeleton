import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/consume_publication/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

const implementation_material_binding = {
  artifact_ref: "artifact://implementation",
  content_hash: `sha256:${"c".repeat(64)}`,
  entry_symbol_ref: "entry",
  immutable: true,
  provider_neutral_locator_binding: { locator_ref: "q-storage://implementation" },
};
const implementation_binding_hash = `sha256:${createHash("sha256").update(JSON.stringify(implementation_material_binding), "utf8").digest("hex")}`;

test("consume_publication verifies and owns V0119 resolver_state", async () => {
  const response = await handler(baseRequest({
    publication: {
      immutable: true,
      capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
      capability_contract_hash: `sha256:${"a".repeat(64)}`,
      publication_hash: `sha256:${"b".repeat(64)}`,
      implementation_material_binding,
      implementation_binding_hash,
    },
    verification: { integrity_verified: true },
  }));
  const verified = response.runtime_result.verified_publication as Record<string, unknown>;
  const resolver = verified.resolver_state as Record<string, unknown>;
  assert.equal(resolver.verified, true);
  assert.equal(resolver.implementation_binding_hash, implementation_binding_hash);
});

test("consume_publication fails closed on implementation binding hash mismatch", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      publication: {
        immutable: true,
        capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
        capability_contract_hash: `sha256:${"a".repeat(64)}`,
        publication_hash: `sha256:${"b".repeat(64)}`,
        implementation_material_binding,
        implementation_binding_hash: `sha256:${"d".repeat(64)}`,
      },
      verification: { integrity_verified: true },
    })),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_IMPLEMENTATION_BINDING_HASH_MISMATCH",
  );
});
