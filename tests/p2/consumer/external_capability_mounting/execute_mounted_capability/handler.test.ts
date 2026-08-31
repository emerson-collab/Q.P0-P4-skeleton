import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/execute_mounted_capability/handler.ts";

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
const active_mount = {
  mount_hash: `sha256:${"a".repeat(64)}`,
  status: "ACTIVE",
  resolver_state: {
    verified: true,
    implementation_material_binding,
    implementation_binding_hash,
  },
};

test("execute_mounted_capability passes exact V0117 implementation binding only to local P0", async () => {
  let calls = 0;
  const response = await handler(baseRequest({
    active_mount,
    exact_interface_binding: { interface_ref: "Q.PROVIDER.CONTRACT.CAPABILITY.X@V0100#/interfaces/run_invoke", surface: "CALL", kind_code: "M1" },
    operation_input: { value: 1 },
  }), {
    async invoke_local_p0(input) {
      calls += 1;
      assert.deepEqual(input.implementation_material_binding, implementation_material_binding);
      assert.equal(input.exact_interface_binding.interface_ref, "Q.PROVIDER.CONTRACT.CAPABILITY.X@V0100#/interfaces/run_invoke");
      return { ok: true };
    },
  });
  assert.equal(calls, 1);
  const execution = response.runtime_result.mounted_execution as Record<string, unknown>;
  assert.equal(execution.implementation_binding_hash, implementation_binding_hash);
});

test("execute_mounted_capability fails closed on protocol translation", async () => {
  await assert.rejects(
    () => handler(baseRequest({
      active_mount,
      exact_interface_binding: { interface_ref: "x", translation: true },
      operation_input: {},
    }), { async invoke_local_p0() { return {}; } }),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_PROTOCOL_TRANSLATION_FORBIDDEN",
  );
});
