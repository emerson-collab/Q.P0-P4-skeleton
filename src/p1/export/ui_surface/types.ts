export type JsonObject = Readonly<Record<string, unknown>>;

export interface StableErrorOutcome {
  readonly outcome_type: "stable_error";
  readonly stable_error: Readonly<{ case: string }>;
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
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

export interface UiModuleArtifact {
  readonly ui_module_ref: string;
  readonly source_capability_ref: string;
  readonly projection_ref: string;
  readonly semantic_model: unknown;
  readonly action_bindings: readonly unknown[];
  readonly state_bindings: readonly unknown[];
  readonly evidence_views: readonly unknown[];
  readonly content_hash: string;
}

export interface CreateUiSurfaceRequest {
  readonly ui_surface_ref: string;
  readonly surface_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface CreateUiSurfaceResponse {
  readonly outcome_type: "response";
  readonly ui_surface_artifact: UiSurfaceArtifact;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export type CreateUiSurfaceOutcome = CreateUiSurfaceResponse | StableErrorOutcome;

export interface ResolveUiSurfaceRequest {
  readonly ui_surface_ref: string;
  readonly resolution_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface ResolveUiSurfaceResponse {
  readonly outcome_type: "response";
  readonly ui_surface_artifact: UiSurfaceArtifact;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export type ResolveUiSurfaceOutcome = ResolveUiSurfaceResponse | StableErrorOutcome;
