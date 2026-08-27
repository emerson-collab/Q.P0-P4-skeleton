import { P0_CONTRACT_REF, P0_PROVIDER_SYMBOL_REF, deep_freeze } from "../../p0/runtime_contract.ts";
import type { StageExtensionContract } from "../../p0/runtime_contract.ts";

export const P1_CONTRACT_REF = "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174" as const;

export interface P1CapabilityOverlayBinding {
  readonly implementation_ref: string;
  readonly provided_interface_refs: readonly string[];
  readonly hook_consumer_refs?: readonly string[];
  readonly hook_binding_refs?: readonly string[];
  readonly port_refs?: readonly string[];
}

export function create_p1_capability_stage_extension(
  binding: P1CapabilityOverlayBinding,
): StageExtensionContract {
  return deep_freeze({
    stage_id: "P1",
    stage_role: "NONE",
    stage_contract_ref: P1_CONTRACT_REF,
    implementation_ref: binding.implementation_ref,
    provided_interface_refs: [...binding.provided_interface_refs],
    consumed_interface_refs: [`${P0_CONTRACT_REF}#/interfaces/runtime_execution_invoke`],
    hook_consumer_refs: [...(binding.hook_consumer_refs ?? [])],
    hook_binding_refs: [...(binding.hook_binding_refs ?? [])],
    port_refs: [...(binding.port_refs ?? [])],
    upstream_runtime_ref: P0_CONTRACT_REF,
    runtime_provider_symbol_ref: P0_PROVIDER_SYMBOL_REF,
    status: "active",
    rule_version_ref: P1_CONTRACT_REF,
  });
}
