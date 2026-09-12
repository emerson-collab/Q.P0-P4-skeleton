export type JsonObject = Readonly<Record<string, unknown>>;

export interface StableErrorOutcome {
  readonly outcome_type: "stable_error";
  readonly stable_error: Readonly<{ case: string }>;
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
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

export interface ResolveUiModuleRequest {
  readonly source_capability_ref: string;
  readonly projection_ref: string;
  readonly projection_input: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface ResolveUiModuleResponse {
  readonly outcome_type: "response";
  readonly ui_module_artifact: UiModuleArtifact;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export type ResolveUiModuleOutcome = ResolveUiModuleResponse | StableErrorOutcome;
