export const capability_extraction_metadata = Object.freeze({
  "capability_id": "capability_presentation",
  "capability_ref": "Q.APP.CAPABILITY.CAPABILITY_PRESENTATION@V0104",
  "capability_version": "V0104",
  "capability_contract_ref": "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104",
  "capability_contract_hash": "sha256:795a646eb362a598b5ce928e2d0570ffba23c4fe139069b9935f8f6974884051",
  "runtime_contract_ref": "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134",
  "extraction_mode": "PUBLICATION_ELIGIBLE",
  "entry_ref": "src/p1/export/capability_presentation/entry.ts#entry",
  "metadata_ref": "src/p1/export/capability_presentation/metadata.ts#capability_extraction_metadata",
  "public_operation_refs": [
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/operations/resolve_capability_presentation"
  ],
  "public_interface_refs": [
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/interfaces/capability_presentation_invoke"
  ],
  "public_contract_refs": [
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/contracts/resolve_capability_presentation_request_contract",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/contracts/resolve_capability_presentation_response_contract",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/stable_error_contract"
  ],
  "public_type_refs": [
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/type_closure/schemas/capability_requirements",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/type_closure/schemas/capability_presentation_specification",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/type_closure/schemas/ui_module_instance_requirement",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/type_closure/schemas/presentation_subject",
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/type_closure/schemas/operation_presentation_binding"
  ],
  "stable_error_contract_ref": "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104#/stable_error_contract",
  "dependency_refs": [
    "Q.UI.CONTRACT.DOMAIN@${CURRENT}",
    "Q.SS.STD.META.CONTRACT.CAPABILITY_INSTANCE@V0120",
    "Q.SS.STD.META.CONTRACT.CAPABILITY_BINDING_DECLARATION@V0104"
  ]
} as const);
