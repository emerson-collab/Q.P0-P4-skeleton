import assert from "node:assert/strict";
import test from "node:test";
import { create_p1_capability_stage_extension } from "../../../src/p1/business_runtime/stage_extension_contract.ts";

test("static StageExtension remains publication-active and aligned to CURRENT P1 authority", () => {
  const extension = create_p1_capability_stage_extension({
    implementation_ref: "Q.TEST.IMPLEMENTATION.EXAMPLE@V0100",
    provided_interface_refs: ["Q.TEST.INTERFACE.EXAMPLE@V0100"],
  });
  assert.equal(extension.status, "active");
  assert.equal(extension.stage_contract_ref, "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0182");
});

test("concrete Capability values fill fixed P1 StageExtension slots directly", () => {
  const capabilityContractRef = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
  const interfaceRef = `${capabilityContractRef}#/interfaces/example_invoke`;
  const hookRef = "Q.TEST.HOOK.EXAMPLE@V0100";
  const portRef = "Q.TEST.PORT.EXAMPLE@V0100";

  const extension = create_p1_capability_stage_extension({
    implementation_ref: capabilityContractRef,
    provided_interface_refs: [interfaceRef],
    hook_consumer_refs: [hookRef],
    port_refs: [portRef],
  });

  assert.equal(extension.implementation_ref, capabilityContractRef);
  assert.deepEqual(extension.provided_interface_refs, [interfaceRef]);
  assert.deepEqual(extension.hook_consumer_refs, [hookRef]);
  assert.deepEqual(extension.port_refs, [portRef]);
});
