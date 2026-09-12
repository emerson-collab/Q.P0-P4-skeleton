export const public_contracts = Object.freeze({
  capability_contract_hash: "sha256:ef15f2e24dc48e26e1e48ae182ff4af45b608926c637a98bae34741ef5da144f",
  capability_contract_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108",
  capability_ref: "Q.UI.CAPABILITY.UI_MODULE@V0108",
  capability_version: "V0108",
  runtime_contract_ref: "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134",
  dependencies: { capability_presentation: "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0105" },
  interfaces: { ui_module_resolution_invoke: { interface_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108#/interfaces/ui_module_resolution_invoke", kind: "CALL_INVOKE", method_ref: "resolve_ui_module", operation_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108#/operations/resolve_ui_module", surface: "CALL" } },
  operations: { resolve_ui_module: { operation_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108#/operations/resolve_ui_module", stable_error_contract_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108#/stable_errors/resolve_ui_module" } },
  outcome_contract: { allowed_values: ["response","stable_error"], discriminator: "outcome_type", exactly_one_variant: true }
} as const);
export const CAPABILITY_CONTRACT_REF=public_contracts.capability_contract_ref;export const CAPABILITY_CONTRACT_HASH=public_contracts.capability_contract_hash;export const CAPABILITY_REF=public_contracts.capability_ref;export const RUNTIME_CONTRACT_REF=public_contracts.runtime_contract_ref;
