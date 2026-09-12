import test from "node:test";
import assert from "node:assert/strict";
import { handler, OPERATION_REF } from "../../../../src/p1/ui_render/execute_ui_render/handler.ts";
import { registered_business_operation_refs } from "../../../../src/p1/business_runtime/business_operation_registry.ts";

test("execute_ui_render preserves surface/theme/target lineage", async () => {
  const result = await handler({
    ui_render_ref: "Q.UI.RENDER@V0100",
    ui_surface_ref: "Q.UI.SURFACE@V0100",
    render_input: {
      ui_surface_artifact: {ui_surface_ref:"Q.UI.SURFACE@V0100"},
      renderer_provider_ref: "Q.UI.RENDERER@V0100",
      theme_ref: "Q.THEME.BINDING@V0100",
      target_profile_ref: "Q.UI.TARGET@V0100",
    },
    trace_id: "trace-1", request_id: "request-1",
  });
  assert.equal(result.outcome_type, "response");
  if (result.outcome_type !== "response") return;
  assert.equal(result.ui_render_artifact.theme_ref, "Q.THEME.BINDING@V0100");
  assert.match(result.ui_render_artifact.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));
});

test("execute_ui_render fails closed without theme binding", async () => {
  const result = await handler({
    ui_render_ref: "Q.UI.RENDER@V0100",
    ui_surface_ref: "Q.UI.SURFACE@V0100",
    render_input: { ui_surface_artifact: {ui_surface_ref:"Q.UI.SURFACE@V0100"} },
    trace_id: "trace-2", request_id: "request-2",
  });
  assert.equal(result.outcome_type, "stable_error");
  if (result.outcome_type !== "stable_error") return;
  assert.equal(result.stable_error.case, "theme binding missing or invalid");
});
