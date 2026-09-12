export const capability_extraction_metadata = Object.freeze({
  "capability_id": "application_presentation",
  "capability_ref": "Q.APP.CAPABILITY.APPLICATION_PRESENTATION@V0104",
  "capability_version": "V0104",
  "capability_contract_ref": "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104",
  "capability_contract_hash": "sha256:d1c45325e5a08b80234d1354b5ab30489162868468b74892e70852921ecb3104",
  "runtime_contract_ref": "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134",
  "extraction_mode": "PUBLICATION_ELIGIBLE",
  "entry_ref": "src/p1/export/application_presentation/entry.ts#entry",
  "metadata_ref": "src/p1/export/application_presentation/metadata.ts#capability_extraction_metadata",
  "public_operation_refs": [
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/operations/resolve_application_presentation"
  ],
  "public_interface_refs": [
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/interfaces/application_presentation_invoke"
  ],
  "public_contract_refs": [
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/contracts/resolve_application_presentation_request_contract",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/contracts/resolve_application_presentation_response_contract",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/stable_error_contract"
  ],
  "public_type_refs": [
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/application_requirements",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/capability_presentation_declaration",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/application_presentation_specification",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/application_ui_instance_plan",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/domain_workspace",
    "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/type_closure/schemas/presentation_subject_group"
  ],
  "stable_error_contract_ref": "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104#/stable_error_contract",
  "dependency_refs": [
    "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104",
    "Q.UI.CONTRACT.DOMAIN@${CURRENT}",
    "Q.SS.STD.META.CONTRACT.CAPABILITY_INSTANCE@V0120",
    "Q.SS.STD.META.CONTRACT.CAPABILITY_BINDING_DECLARATION@V0104"
  ]
} as const);
