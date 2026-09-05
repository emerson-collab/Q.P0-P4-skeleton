import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/rollback_mount/handler.ts";

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

test("rollback_mount preserves the target V0118 resolver_state", async () => {
  const response = await handler(baseRequest({
    active_mount: {
      mount_hash: `sha256:${"a".repeat(64)}`,
      status: "ACTIVE",
      verified_publication: { verified: true },
    },
    rollback_target_mount: {
      mount_hash: `sha256:${"b".repeat(64)}`,
      status: "INACTIVE",
      verified_publication: { verified: true },
      resolver_state,
      implementation_binding_hash: resolver_state.implementation_binding_hash,
    },
  }));
  const active = response.runtime_result.active_mount as Record<string, unknown>;
  assert.equal(active.status, "ACTIVE");
  assert.deepEqual(active.resolver_state, resolver_state);
});

test("rollback_mount fails closed on invalid target resolver state", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      active_mount: { mount_hash: `sha256:${"a".repeat(64)}`, status: "ACTIVE" },
      rollback_target_mount: {
        mount_hash: `sha256:${"b".repeat(64)}`,
        verified_publication: { verified: true },
        resolver_state: { verified: false },
        implementation_binding_hash: `sha256:${"c".repeat(64)}`,
      },
    })),
    (error: unknown) => error instanceof P2StableError,
  );
});
