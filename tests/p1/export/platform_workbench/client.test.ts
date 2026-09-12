import assert from "node:assert/strict";
import test from "node:test";
import { platform_workbench_client_projection } from "../../../../src/p1/export/platform_workbench/client";

test("client projection preserves exact declared CALL interface without runtime execution", () => {
  assert.equal(platform_workbench_client_projection.surface, "CALL");
  assert.equal(platform_workbench_client_projection.kind_code, "M1");
  assert.equal(platform_workbench_client_projection.kind, "CALL_INVOKE");
  assert.equal(platform_workbench_client_projection.method_ref, "render_platform_workbench");
  assert.deepEqual(platform_workbench_client_projection.path, ["request_id", "trace_id"]);
  assert.deepEqual(platform_workbench_client_projection.static_mount, ["operation_contract"]);
  assert.deepEqual(platform_workbench_client_projection.dynamic_mount, ["input", "runtime_context", "outcome_type", "runtime_result", "stable_error", "evidence_ref", "execution_receipt"]);
});
