import {
  INTERFACE_REF,
  OPERATION_REF,
  OUTCOME_CONTRACT_REF,
  REQUEST_CONTRACT_REF,
  RESPONSE_CONTRACT_REF,
  STABLE_ERROR_CONTRACT_REF,
} from "./contracts";

export const platform_workbench_client_projection = Object.freeze({
  interface_ref: INTERFACE_REF,
  operation_ref: OPERATION_REF,
  surface: "CALL" as const,
  kind_code: "M1" as const,
  kind: "CALL_INVOKE" as const,
  method_ref: "render_platform_workbench" as const,
  path: Object.freeze(["request_id", "trace_id"] as const),
  static_mount: Object.freeze(["operation_contract"] as const),
  dynamic_mount: Object.freeze([
    "input",
    "runtime_context",
    "outcome_type",
    "runtime_result",
    "stable_error",
    "evidence_ref",
    "execution_receipt",
  ] as const),
  request_contract_ref: REQUEST_CONTRACT_REF,
  response_contract_ref: RESPONSE_CONTRACT_REF,
  stable_error_contract_ref: STABLE_ERROR_CONTRACT_REF,
  outcome_contract_ref: OUTCOME_CONTRACT_REF,
});
