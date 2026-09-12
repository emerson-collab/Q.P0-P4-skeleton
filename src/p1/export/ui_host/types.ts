export interface StableErrorOutcome {
  readonly outcome_type: "stable_error";
  readonly stable_error: Readonly<{ case: string }>;
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface UiHostResult {
  readonly ui_host_ref: string;
  readonly host_instance_ref: string;
  readonly render_artifact_ref: string;
  readonly lifecycle_state: string;
  readonly receipt_ref: string;
}

export interface UiRenderArtifact {
  readonly render_artifact_ref: string;
  readonly ui_surface_ref: string;
  readonly renderer_provider_ref: string;
  readonly theme_ref: string;
  readonly target_profile_ref: string;
  readonly content_hash: string;
}

export interface ActivateUiHostRequest {
  readonly ui_host_ref: string;
  readonly render_artifact_ref: string;
  readonly activation_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface ActivateUiHostResponse {
  readonly outcome_type: "response";
  readonly ui_host_result: UiHostResult;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}
export type ActivateUiHostOutcome = ActivateUiHostResponse | StableErrorOutcome;

export interface DeactivateUiHostRequest {
  readonly ui_host_ref: string;
  readonly host_instance_ref: string;
  readonly deactivation_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface DeactivateUiHostResponse {
  readonly outcome_type: "response";
  readonly ui_host_result: UiHostResult;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}
export type DeactivateUiHostOutcome = DeactivateUiHostResponse | StableErrorOutcome;
