export type PlatformJsonPrimitive = string | number | boolean | null;
export type PlatformJsonValue =
  | PlatformJsonPrimitive
  | PlatformJsonValue[]
  | { [key: string]: PlatformJsonValue };
export type PlatformJsonObject = { [key: string]: PlatformJsonValue };

export interface PlatformDesignRequirements {
  workspace_design: PlatformJsonObject;
  domain_aggregation_design: PlatformJsonObject;
  navigation_design: PlatformJsonObject;
  arrangement_design: PlatformJsonObject;
  dock_design: PlatformJsonObject;
  responsive_composition_requirements: PlatformJsonObject;
}

export interface RenderPlatformWorkbenchRequest {
  platform_presentation_ref: string;
  platform_design_requirements: PlatformDesignRequirements;
}

export interface PlatformPresentationContext {
  presentation_context_ref: string;
  presentation_context_kind: "PLATFORM";
  workspace_design: PlatformJsonObject;
  domain_aggregation_design: PlatformJsonObject;
  navigation_design: PlatformJsonObject;
  arrangement_design: PlatformJsonObject;
  dock_design: PlatformJsonObject;
  responsive_composition_requirements: PlatformJsonObject;
  surface_requirements: PlatformJsonObject;
  content_hash: string;
}

export interface RenderPlatformWorkbenchResponse {
  platform_presentation_context: PlatformPresentationContext;
}

export type PlatformWorkbenchStableErrorCode =
  | "PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID"
  | "PLATFORM_PRESENTATION_DESIGN_CONFLICT"
  | "PLATFORM_BUSINESS_SEMANTIC_INPUT_FORBIDDEN"
  | "PLATFORM_Q_UI_RENDER_OWNERSHIP_VIOLATION"
  | "PLATFORM_THEME_OWNERSHIP_VIOLATION"
  | "PLATFORM_UNDECLARED_PRESENTATION_FIELD";

export interface PlatformWorkbenchStableError {
  error_code: PlatformWorkbenchStableErrorCode;
  message: string;
}

export type PlatformWorkbenchCallOutcome =
  | {
      outcome_type: "response";
      runtime_result: RenderPlatformWorkbenchResponse;
      trace_id: string;
      request_id: string;
    }
  | {
      outcome_type: "stable_error";
      stable_error: PlatformWorkbenchStableError;
      trace_id: string;
      request_id: string;
    };
