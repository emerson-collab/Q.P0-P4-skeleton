import {
  CAPABILITY_CONTRACT_REF,
  CAPABILITY_REF,
  EXTERNAL_PROVIDER_SURFACE_REF,
  INTERFACE_REF,
  OPERATION_REF,
  REQUEST_CONTRACT_REF,
  RESPONSE_CONTRACT_REF,
  STABLE_ERROR_CONTRACT_REF,
} from "./contracts";
import { platform_workbench_client_projection } from "./client";

export const entry = Object.freeze({
  capability_ref: CAPABILITY_REF,
  capability_contract_ref: CAPABILITY_CONTRACT_REF,
  external_provider_surface_ref: EXTERNAL_PROVIDER_SURFACE_REF,
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
  client_projection: platform_workbench_client_projection,
});

export default entry;
