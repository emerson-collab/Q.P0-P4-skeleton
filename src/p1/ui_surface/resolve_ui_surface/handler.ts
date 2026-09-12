import { createHash } from "node:crypto";
import { register_business_operation } from "../../business_runtime/business_operation_registry.ts";

export type JsonObject = Readonly<Record<string, unknown>>;
function objectValue(value: unknown, field: string): JsonObject { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} must be a non-empty string`); return value; }
function arrayValue(value: unknown, field: string): readonly unknown[] { if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`); return value; }
function stableClone(value: unknown): unknown { if (Array.isArray(value)) return Object.freeze(value.map(stableClone)); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; const out: Record<string, unknown> = {}; for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]); return Object.freeze(out); } return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`; }
export interface StableErrorOutcome { readonly outcome_type: "stable_error"; readonly stable_error: Readonly<{ case: string }>; readonly evidence_ref: string; readonly trace_id: string; readonly request_id: string; }
function stableError(trace_id: string, request_id: string, semantic_case: string): StableErrorOutcome { const stable_error = Object.freeze({ case: semantic_case }); return Object.freeze({ outcome_type: "stable_error" as const, stable_error, evidence_ref: sha256Json({ operation_ref: OPERATION_REF, stable_error, trace_id, request_id }), trace_id, request_id }); }
export const CAPABILITY_ID = "ui_surface" as const;
export const CAPABILITY_CONTRACT_REF = "Q.UI.CONTRACT.CAPABILITY.UI_SURFACE@V0108" as const;
export const OPERATION_ID = "resolve_ui_surface" as const;
export const OPERATION_REF = `${CAPABILITY_CONTRACT_REF}#/operations/${OPERATION_ID}` as const;
export interface ResolveUiSurfaceRequest { readonly ui_surface_ref: string; readonly resolution_input: unknown; readonly trace_id: string; readonly request_id: string; }
export interface UiSurfaceArtifact { readonly ui_surface_ref: string; readonly ui_module_refs: readonly unknown[]; readonly regions: readonly unknown[]; readonly slots: readonly unknown[]; readonly navigation_projection: unknown; readonly interaction_bindings: readonly unknown[]; readonly content_hash: string; }
export interface ResolveUiSurfaceResponse { readonly outcome_type: "response"; readonly ui_surface_artifact: UiSurfaceArtifact; readonly evidence_ref: string; readonly receipt_ref: string; readonly trace_id: string; readonly request_id: string; }
export type ResolveUiSurfaceOutcome = ResolveUiSurfaceResponse | StableErrorOutcome;
export async function handler(input: unknown): Promise<ResolveUiSurfaceOutcome> {
  const request = objectValue(input, "input"); const ui_surface_ref = stringValue(request.ui_surface_ref, "ui_surface_ref"); const trace_id = stringValue(request.trace_id, "trace_id"); const request_id = stringValue(request.request_id, "request_id"); const material = objectValue(request.resolution_input, "resolution_input");
  let ui_module_refs: readonly unknown[]; let regions: readonly unknown[]; let slots: readonly unknown[]; let interaction_bindings: readonly unknown[];
  try { ui_module_refs = arrayValue(material.ui_module_refs, "resolution_input.ui_module_refs"); regions = arrayValue(material.regions, "resolution_input.regions"); slots = arrayValue(material.slots, "resolution_input.slots"); interaction_bindings = arrayValue(material.interaction_bindings, "resolution_input.interaction_bindings"); }
  catch { return stableError(trace_id, request_id, "target unsupported"); }
  if (material.navigation_projection === undefined) return stableError(trace_id, request_id, "target unsupported");
  if (ui_module_refs.length === 0) return stableError(trace_id, request_id, "framework equivalence closure failed");
  const artifact_body = stableClone({ ui_surface_ref, ui_module_refs, regions, slots, navigation_projection: material.navigation_projection, interaction_bindings }) as JsonObject;
  const ui_surface_artifact = Object.freeze({ ...artifact_body, content_hash: sha256Json(artifact_body) }) as unknown as UiSurfaceArtifact;
  const evidence_ref = sha256Json({ operation_ref: OPERATION_REF, ui_surface_artifact, trace_id, request_id }); const receipt_ref = sha256Json({ operation_ref: OPERATION_REF, outcome_type: "response", ui_surface_artifact, evidence_ref, trace_id, request_id });
  return Object.freeze({ outcome_type: "response" as const, ui_surface_artifact, evidence_ref, receipt_ref, trace_id, request_id });
}
register_business_operation(OPERATION_REF, handler);
