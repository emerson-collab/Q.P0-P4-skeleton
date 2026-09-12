import test from "node:test";
import assert from "node:assert/strict";
import { create_client } from "../../../../src/p1/export/ui_module/client.ts";

test("ui_module client invokes the exact frozen public Operation ref without importing a Handler", async () => {
  const calls: Array<{operation_ref:string; input:unknown}> = [];
  const client = create_client({ async invoke(operation_ref, input) { calls.push({ operation_ref, input }); return { outcome_type:"stable_error", stable_error:{case:"test"}, evidence_ref:"sha256:"+"0".repeat(64), trace_id:"t", request_id:"r" }; } });
  await client.resolve_ui_module({ source_capability_ref:"Q.EXAMPLE.CAPABILITY.PAGE@V0100", projection_ref:"Q.UI.MODULE@V0100", projection_input:{semantic_model:{},action_bindings:[],state_bindings:[],evidence_views:[]}, trace_id:"t", request_id:"r" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.operation_ref, "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0106#/operations/resolve_ui_module");
});
