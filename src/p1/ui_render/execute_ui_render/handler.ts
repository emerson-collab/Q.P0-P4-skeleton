import { createHash } from "node:crypto";
import { register_business_operation } from "../../business_runtime/business_operation_registry.ts";

export type JsonObject = Readonly<Record<string, unknown>>;
function objectValue(value: unknown, field: string): JsonObject { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} must be a non-empty string`); return value; }
function stableClone(value: unknown): unknown { if (Array.isArray(value)) return Object.freeze(value.map(stableClone)); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; const out: Record<string, unknown> = {}; for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]); return Object.freeze(out); } return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`; }
export interface StableErrorOutcome { readonly outcome_type: "stable_error"; readonly stable_error: Readonly<{ case: string }>; readonly evidence_ref: string; readonly trace_id: string; readonly request_id: string; }
function stableError(trace_id: string, request_id: string, semantic_case: string): StableErrorOutcome { const stable_error = Object.freeze({ case: semantic_case }); return Object.freeze({ outcome_type: "stable_error" as const, stable_error, evidence_ref: sha256Json({ operation_ref: OPERATION_REF, stable_error, trace_id, request_id }), trace_id, request_id }); }
export const CAPABILITY_ID = "ui_render" as const;
export const CAPABILITY_CONTRACT_REF = "Q.UI.CONTRACT.CAPABILITY.UI_RENDER@V0108" as const;
export const OPERATION_ID = "execute_ui_render" as const;
export const OPERATION_REF = `${CAPABILITY_CONTRACT_REF}#/operations/${OPERATION_ID}` as const;
export interface ExecuteUiRenderRequest { readonly ui_render_ref: string; readonly ui_surface_ref: string; readonly render_input: unknown; readonly trace_id: string; readonly request_id: string; }
export interface UiRenderArtifact { readonly render_artifact_ref: string; readonly ui_surface_ref: string; readonly renderer_provider_ref: string; readonly theme_ref: string; readonly target_profile_ref: string; readonly content_hash: string; }
export interface ExecuteUiRenderResponse { readonly outcome_type: "response"; readonly ui_render_artifact: UiRenderArtifact; readonly evidence_ref: string; readonly receipt_ref: string; readonly trace_id: string; readonly request_id: string; }
export type ExecuteUiRenderOutcome = ExecuteUiRenderResponse | StableErrorOutcome;
export async function handler(input: unknown): Promise<ExecuteUiRenderOutcome> {
  const request = objectValue(input, "input"); const ui_render_ref = stringValue(request.ui_render_ref, "ui_render_ref"); const ui_surface_ref = stringValue(request.ui_surface_ref, "ui_surface_ref"); const trace_id = stringValue(request.trace_id, "trace_id"); const request_id = stringValue(request.request_id, "request_id"); const render_input = objectValue(request.render_input, "render_input");
  let ui_surface_artifact: JsonObject;
  try { ui_surface_artifact = objectValue(render_input.ui_surface_artifact, "render_input.ui_surface_artifact"); }
  catch { return stableError(trace_id, request_id, "target/theme incompatibility"); }
  if (ui_surface_artifact.ui_surface_ref !== ui_surface_ref) return stableError(trace_id, request_id, "target/theme incompatibility");
  let renderer_provider_ref: string; let theme_ref: string; let target_profile_ref: string;
  try { renderer_provider_ref = stringValue(render_input.renderer_provider_ref, "render_input.renderer_provider_ref"); theme_ref = stringValue(render_input.theme_ref, "render_input.theme_ref"); target_profile_ref = stringValue(render_input.target_profile_ref, "render_input.target_profile_ref"); }
  catch { return stableError(trace_id, request_id, "theme binding missing or invalid"); }
  const artifact_body = stableClone({ render_artifact_ref: ui_render_ref, ui_surface_ref, renderer_provider_ref, theme_ref, target_profile_ref }) as JsonObject;
  const ui_render_artifact = Object.freeze({ ...artifact_body, content_hash: sha256Json(artifact_body) }) as unknown as UiRenderArtifact;
  const evidence_ref = sha256Json({ operation_ref: OPERATION_REF, ui_render_artifact, trace_id, request_id }); const receipt_ref = sha256Json({ operation_ref: OPERATION_REF, outcome_type: "response", ui_render_artifact, evidence_ref, trace_id, request_id });
  return Object.freeze({ outcome_type: "response" as const, ui_render_artifact, evidence_ref, receipt_ref, trace_id, request_id });
}
register_business_operation(OPERATION_REF, handler);
