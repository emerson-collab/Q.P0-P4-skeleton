import test from "node:test";
import assert from "node:assert/strict";
import { handler, OPERATION_REF } from "../../../../src/p1/ui_surface/resolve_ui_surface/handler.ts";
import { registered_business_operation_refs } from "../../../../src/p1/business_runtime/business_operation_registry.ts";

test("resolve_ui_surface produces a target-compatible closed artifact", async () => {
  const result = await handler({
    ui_surface_ref: "Q.UI.SURFACE@V0100",
    resolution_input: { ui_module_refs: ["Q.UI.MODULE@V0100"], regions: [{id:"main"}], slots: [], navigation_projection: {mode:"target"}, interaction_bindings: [] },
    trace_id: "trace-1", request_id: "request-1",
  });
  assert.equal(result.outcome_type, "response");
  if (result.outcome_type !== "response") return;
  assert.match(result.ui_surface_artifact.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));
});

test("resolve_ui_surface fails closed when target material is incomplete", async () => {
  const result = await handler({
    ui_surface_ref: "Q.UI.SURFACE@V0100",
    resolution_input: { ui_module_refs: [], regions: [], slots: [], interaction_bindings: [] },
    trace_id: "trace-2", request_id: "request-2",
  });
  assert.equal(result.outcome_type, "stable_error");
  if (result.outcome_type !== "stable_error") return;
  assert.equal(result.stable_error.case, "target unsupported");
});
