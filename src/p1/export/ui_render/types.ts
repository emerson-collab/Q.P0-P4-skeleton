export type JsonObject = Readonly<Record<string, unknown>>;

export interface StableErrorOutcome {
  readonly outcome_type: "stable_error";
  readonly stable_error: Readonly<{ case: string }>;
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface UiRenderArtifact {
  readonly render_artifact_ref: string;
  readonly ui_surface_ref: string;
  readonly renderer_provider_ref: string;
  readonly theme_ref: string;
  readonly target_profile_ref: string;
  readonly content_hash: string;
}

export interface UiSurfaceArtifact {
  readonly ui_surface_ref: string;
  readonly ui_module_refs: readonly unknown[];
  readonly regions: readonly unknown[];
  readonly slots: readonly unknown[];
  readonly navigation_projection: unknown;
  readonly interaction_bindings: readonly unknown[];
  readonly content_hash: string;
}

export interface ExecuteUiRenderRequest {
  readonly ui_render_ref: string;
  readonly ui_surface_ref: string;
  readonly render_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface ExecuteUiRenderResponse {
  readonly outcome_type: "response";
  readonly ui_render_artifact: UiRenderArtifact;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export type ExecuteUiRenderOutcome = ExecuteUiRenderResponse | StableErrorOutcome;
