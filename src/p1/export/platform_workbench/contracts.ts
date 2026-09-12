export const CAPABILITY_REF = "Q.PLATFORM.CAPABILITY.PLATFORM_WORKBENCH@V0106" as const;
export const CAPABILITY_CONTRACT_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106" as const;
export const CAPABILITY_CONTRACT_CONTENT_HASH =
  "sha256:2abbebe492d83e6c8980fb51521c2f879b76aa4e930384a5f185c87fbc05e349" as const;
export const OPERATION_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/operations/render_platform_workbench" as const;
export const INTERFACE_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/interfaces/platform_workbench_invoke" as const;
export const REQUEST_CONTRACT_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/contracts/render_platform_workbench_request_contract" as const;
export const RESPONSE_CONTRACT_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/contracts/render_platform_workbench_response_contract" as const;
export const STABLE_ERROR_CONTRACT_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/stable_error_contract" as const;
export const OUTCOME_CONTRACT_REF =
  "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/outcome_contracts/call_outcome" as const;
export const EXTERNAL_PROVIDER_SURFACE_REF =
  "Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/external_provider_surface" as const;

export const STABLE_ERROR_CODES = Object.freeze([
  "PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
  "PLATFORM_PRESENTATION_DESIGN_CONFLICT",
  "PLATFORM_BUSINESS_SEMANTIC_INPUT_FORBIDDEN",
  "PLATFORM_Q_UI_RENDER_OWNERSHIP_VIOLATION",
  "PLATFORM_THEME_OWNERSHIP_VIOLATION",
  "PLATFORM_UNDECLARED_PRESENTATION_FIELD",
] as const);

export const STABLE_ERROR_MESSAGES = Object.freeze({
  PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID:
    "Platform presentation design requirements are incomplete or invalid.",
  PLATFORM_PRESENTATION_DESIGN_CONFLICT:
    "Platform presentation design requirements conflict and cannot be resolved deterministically.",
  PLATFORM_BUSINESS_SEMANTIC_INPUT_FORBIDDEN:
    "The request attempts to provide or depend on concrete Business Domain Capability Operation Interface payload state data or outcome semantics.",
  PLATFORM_Q_UI_RENDER_OWNERSHIP_VIOLATION:
    "The request attempts concrete UI Surface, Render, Host, or server execution inside Q.Platform.",
  PLATFORM_THEME_OWNERSHIP_VIOLATION:
    "The request attempts to define or own Q.Theme visual semantics inside Q.Platform.",
  PLATFORM_UNDECLARED_PRESENTATION_FIELD:
    "The request contains an undeclared platform presentation design field.",
} as const);
