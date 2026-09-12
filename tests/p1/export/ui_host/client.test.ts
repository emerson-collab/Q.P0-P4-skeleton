import test from "node:test";
import assert from "node:assert/strict";
import { create_client } from "../../../../src/p1/export/ui_host/client.ts";

test("ui_host client invokes the exact frozen public Operation ref without importing a Handler", async () => {
  const calls: Array<{operation_ref:string; input:unknown}> = [];
  const client = create_client({ async invoke(operation_ref, input) { calls.push({ operation_ref, input }); return { outcome_type:"stable_error", stable_error:{case:"test"}, evidence_ref:"sha256:"+"0".repeat(64), trace_id:"t", request_id:"r" }; } });
  await client.activate_ui_host({ ui_host_ref:"Q.UI.HOST@V0100", render_artifact_ref:"Q.UI.RENDER@V0100", activation_input:{host_instance_ref:"Q.UI.HOST.INSTANCE@V0100",host_binding:{}}, trace_id:"t", request_id:"r" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.operation_ref, "Q.UI.CONTRACT.CAPABILITY.UI_HOST@V0106#/operations/activate_ui_host");
});
