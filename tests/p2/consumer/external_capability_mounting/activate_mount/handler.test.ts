import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/activate_mount/handler.ts";

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

test("activate_mount preserves the verified V0119 resolver_state", async () => {
  const response = await handler(baseRequest({
    mount: {
      mount_hash: `sha256:${"b".repeat(64)}`,
      status: "INACTIVE",
      verified_publication: { verified: true, publication_hash: `sha256:${"d".repeat(64)}` },
      resolver_state,
      implementation_binding_hash: resolver_state.implementation_binding_hash,
    },
  }));
  const active = response.runtime_result.active_mount as Record<string, unknown>;
  assert.equal(active.status, "ACTIVE");
  assert.deepEqual(active.resolver_state, resolver_state);
});

test("activate_mount fails closed when resolver binding differs", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      mount: {
        mount_hash: `sha256:${"b".repeat(64)}`,
        verified_publication: { verified: true },
        resolver_state,
        implementation_binding_hash: `sha256:${"e".repeat(64)}`,
      },
    })),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_IMPLEMENTATION_BINDING_HASH_MISMATCH",
  );
});
