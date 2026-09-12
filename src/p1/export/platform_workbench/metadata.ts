import {
  CAPABILITY_CONTRACT_CONTENT_HASH,
  CAPABILITY_CONTRACT_REF,
  CAPABILITY_REF,
  EXTERNAL_PROVIDER_SURFACE_REF,
  INTERFACE_REF,
  OPERATION_REF,
  REQUEST_CONTRACT_REF,
  RESPONSE_CONTRACT_REF,
  STABLE_ERROR_CONTRACT_REF,
} from "./contracts";

export const capability_extraction_metadata = Object.freeze({
  capability_ref: CAPABILITY_REF,
  capability_id: "platform_workbench" as const,
  capability_version: "V0106" as const,
  stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}" as const,
  capability_contract_ref: CAPABILITY_CONTRACT_REF,
  capability_contract_content_hash: CAPABILITY_CONTRACT_CONTENT_HASH,
  external_provider_surface_ref: EXTERNAL_PROVIDER_SURFACE_REF,
  external_provider_surface_hash: "RESOLVED_PROJECTION" as const,
  domain_ref: "Q.PLATFORM" as const,
  runtime_contract_ref: "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@${CURRENT}" as const,
  extraction_mode: "PUBLICATION_ELIGIBLE" as const,
  public_entry_ref: "src/p1/export/platform_workbench/entry.ts#entry" as const,
  metadata_ref:
    "src/p1/export/platform_workbench/metadata.ts#capability_extraction_metadata" as const,
  public_operation_refs: Object.freeze([OPERATION_REF] as const),
  public_interface_refs: Object.freeze([INTERFACE_REF] as const),
  public_contract_refs: Object.freeze([
    REQUEST_CONTRACT_REF,
    RESPONSE_CONTRACT_REF,
    STABLE_ERROR_CONTRACT_REF,
  ] as const),
  public_type_refs: Object.freeze([
    "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/type_closure/schemas/platform_design_requirements",
    "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/type_closure/schemas/platform_presentation_context",
  ] as const),
  stable_error_refs: Object.freeze([STABLE_ERROR_CONTRACT_REF] as const),
  dependency_refs: Object.freeze([] as const),
  dependency_classification: Object.freeze({
    RECEIVING_DOMAIN_DEPENDENCY: Object.freeze([] as const),
    PUBLIC_CONTRACT_DEPENDENCY: Object.freeze([] as const),
    STANDARD_AUTHORITY_DEPENDENCY: Object.freeze([] as const),
    PROVIDER_INTERNAL_DEPENDENCY: Object.freeze([] as const),
  }),
  compatibility_ref:
    "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/compatibility" as const,
  source_integrity_ref:
    "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/capability_contract_integrity_binding" as const,
});

export default capability_extraction_metadata;
