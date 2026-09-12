import test from "node:test";
import assert from "node:assert/strict";
import { create_client } from "../../../../src/p1/export/ui_surface/client.ts";

test("ui_surface client invokes the exact frozen public Operation ref without importing a Handler", async () => {
  const calls: Array<{operation_ref:string; input:unknown}> = [];
  const client = create_client({ async invoke(operation_ref, input) { calls.push({ operation_ref, input }); return { outcome_type:"stable_error", stable_error:{case:"test"}, evidence_ref:"sha256:"+"0".repeat(64), trace_id:"t", request_id:"r" }; } });
  await client.create_ui_surface({ ui_surface_ref:"Q.UI.SURFACE@V0100", surface_input:{}, trace_id:"t", request_id:"r" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.operation_ref, "Q.UI.CONTRACT.CAPABILITY.UI_SURFACE@V0106#/operations/create_ui_surface");
});
