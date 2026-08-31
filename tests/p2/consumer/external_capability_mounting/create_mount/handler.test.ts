import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/create_mount/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

const resolver_state = {
  verified: true,
  implementation_binding_hash: `sha256:${"c".repeat(64)}`,
  implementation_material_binding: { artifact_ref: "artifact://implementation" },
};

test("create_mount preserves the verified V0117 resolver_state", async () => {
  const response = await handler(baseRequest({
    verified_publication: {
      verified: true,
      publication_hash: `sha256:${"b".repeat(64)}`,
      publication: { immutable: true },
      resolver_state,
    },
    receiving_domain_ref: "Q.RECEIVER.CONTRACT.DOMAIN@V0100",
    mount_policy: { mode: "PINNED" },
  }));
  const mount = response.runtime_result.mount as Record<string, unknown>;
  assert.deepEqual(mount.resolver_state, resolver_state);
  assert.equal(mount.implementation_binding_hash, resolver_state.implementation_binding_hash);
});

test("create_mount fails closed without verified resolver state", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      verified_publication: {
        verified: true,
        publication_hash: `sha256:${"b".repeat(64)}`,
        resolver_state: { verified: false },
      },
      receiving_domain_ref: "Q.RECEIVER@V0100",
    })),
    (error: unknown) => error instanceof P2StableError,
  );
});
