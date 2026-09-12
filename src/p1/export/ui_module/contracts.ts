export const public_contracts = Object.freeze({
  capability_contract_hash: "sha256:fb48c676b347581c60237b041b1f7f8a42fd054e9da823d223f8f48419e743d4",
  capability_contract_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0111",
  capability_ref: "Q.UI.CAPABILITY.UI_MODULE@V0111",
  capability_version: "V0111",
  runtime_contract_ref: "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134",
  dependencies: { source_business_capability: "Q.UI.DEPENDENCY.SOURCE_BUSINESS_CAPABILITY@V0100" },
  interfaces: { ui_module_resolution_invoke: { interface_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0111#/interfaces/ui_module_resolution_invoke", kind: "CALL_INVOKE", method_ref: "resolve_ui_module", operation_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0111#/operations/resolve_ui_module", surface: "CALL" } },
  operations: { resolve_ui_module: { operation_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0111#/operations/resolve_ui_module", stable_error_contract_ref: "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0111#/stable_error_contract" } },
  outcome_contract: { allowed_values: ["response","stable_error"], discriminator: "outcome_type", exactly_one_variant: true }
} as const);
export const CAPABILITY_CONTRACT_REF=public_contracts.capability_contract_ref;export const CAPABILITY_CONTRACT_HASH=public_contracts.capability_contract_hash;export const CAPABILITY_REF=public_contracts.capability_ref;export const RUNTIME_CONTRACT_REF=public_contracts.runtime_contract_ref;
