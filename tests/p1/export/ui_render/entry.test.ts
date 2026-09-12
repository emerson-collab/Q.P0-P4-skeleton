import test from "node:test";
import assert from "node:assert/strict";
import { entry, stage_extension } from "../../../../src/p1/export/ui_render/entry.ts";

test("ui_render extraction entry is static and bound to the frozen Capability/P1/P0 authority", () => {
  assert.equal(entry.capability_ref, "Q.UI.CAPABILITY.UI_RENDER@V0106");
  assert.equal(entry.capability_contract_ref, "Q.UI.CONTRACT.CAPABILITY.UI_RENDER@V0106");
  assert.equal(stage_extension.stage_contract_ref, "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0175");
  assert.deepEqual(stage_extension.consumed_interface_refs, ["Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134#/interfaces/runtime_execution_invoke"]);
  assert.equal("handler" in entry, false);
});
