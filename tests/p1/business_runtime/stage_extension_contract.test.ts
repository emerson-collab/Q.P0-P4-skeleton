import assert from "node:assert/strict";
import test from "node:test";
import { create_p1_capability_stage_extension } from "../../../src/p1/business_runtime/stage_extension_contract.ts";

test("static StageExtension remains publication-active and aligned to CURRENT P1 authority", () => {
  const extension = create_p1_capability_stage_extension({
    implementation_ref: "Q.TEST.IMPLEMENTATION.EXAMPLE@V0100",
    provided_interface_refs: ["Q.TEST.INTERFACE.EXAMPLE@V0100"],
  });
  assert.equal(extension.status, "active");
  assert.equal(extension.stage_contract_ref, "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0179");
});
