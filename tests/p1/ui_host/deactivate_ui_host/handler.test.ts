import test from "node:test";
import assert from "node:assert/strict";
import { handler, OPERATION_REF } from "../../../../src/p1/ui_host/deactivate_ui_host/handler.ts";
import { registered_business_operation_refs } from "../../../../src/p1/business_runtime/business_operation_registry.ts";

test("deactivate_ui_host closes the presentation lifecycle result", async () => {
  const result = await handler({
    ui_host_ref: "Q.UI.HOST@V0100",
    host_instance_ref: "Q.UI.HOST.INSTANCE@V0100",
    deactivation_input: { render_artifact_ref: "Q.UI.RENDER@V0100" },
    trace_id: "trace-1", request_id: "request-1",
  });
  assert.equal(result.outcome_type, "response");
  if (result.outcome_type !== "response") return;
  assert.equal(result.ui_host_result.lifecycle_state, "inactive");
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));
});

test("deactivate_ui_host fails closed when host identity cannot close", async () => {
  const result = await handler({
    ui_host_ref: "Q.UI.HOST@V0100",
    host_instance_ref: "Q.UI.HOST.INSTANCE@V0100",
    deactivation_input: {},
    trace_id: "trace-2", request_id: "request-2",
  });
  assert.equal(result.outcome_type, "stable_error");
  if (result.outcome_type !== "stable_error") return;
  assert.equal(result.stable_error.case, "host identity unresolved");
});
