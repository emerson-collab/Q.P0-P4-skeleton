import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/execute_mounted_capability/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("execute_mounted_capability uses only injected local P0 execution and preserves exact interface binding", async () => {
  let calls = 0;
  const response = await handler(baseRequest({
  active_mount: {
  mount_hash: `sha256:${"a".repeat(64)}`,
  status: "ACTIVE",
  verified_publication: { verified: true },
},
  exact_interface_binding: { interface_ref: "Q.PROVIDER.CONTRACT.CAPABILITY.X@V0100#/interfaces/run_invoke", surface: "CALL", kind_code: "M1" },
  operation_input: { value: 1 },
}), {
    async invoke_local_p0(input) {
      calls += 1;
      assert.equal(input.exact_interface_binding.interface_ref, "Q.PROVIDER.CONTRACT.CAPABILITY.X@V0100#/interfaces/run_invoke");
      return { ok: true };
    },
  });
  assert.equal(calls, 1);
  assert.equal(response.runtime_result.result_kind, "MOUNTED_CAPABILITY_EXECUTION");
});

test("execute_mounted_capability fails closed on protocol translation", async () => {
  await assert.rejects(
    () => handler(baseRequest({
  active_mount: {
  mount_hash: `sha256:${"a".repeat(64)}`,
  status: "ACTIVE",
  verified_publication: { verified: true },
},
  exact_interface_binding: { interface_ref: "x", translation: true },
  operation_input: {},
}), { async invoke_local_p0() { return {}; } }),
    (error: unknown) => error instanceof P2StableError && error.code === "P2_PROTOCOL_TRANSLATION_FORBIDDEN",
  );
});
