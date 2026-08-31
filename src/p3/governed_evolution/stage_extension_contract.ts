import { createHash } from "node:crypto";

export const P3_CONTRACT_REF = "Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145" as const;
export const P3_CONTRACT_HASH = "sha256:e26f7adb3f0fd32f6ec9dd9e121c74649b1280c261da9f91e83cbb7351a91da4" as const;
export const P3_CAPABILITY_ID = "governed_evolution" as const;
export const P3_OPERATIONS = Object.freeze([
  "inspect_change", "create_candidate", "validate_candidate", "approve_candidate",
  "activate_candidate", "evaluate_candidate", "rollback_candidate", "read_receipt",
] as const);
export type P3OperationId = (typeof P3_OPERATIONS)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;

export interface P3PathLayer {
  readonly route_key: string;
  readonly operation_id: string;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface P3StaticMountLayer {
  readonly operation_contract: string;
  readonly policy_refs: readonly string[];
  readonly receipt_contract_ref: string;
}
export interface P3Call<I extends JsonObject = JsonObject> extends P3PathLayer, P3StaticMountLayer {
  readonly input: I;
  readonly context: JsonObject;
}
export interface StableErrorWire {
  readonly code: string;
  readonly message: string;
  readonly category: string;
  readonly retriable: boolean;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface EvolutionReceipt {
  readonly receipt_ref: string;
  readonly receipt_hash: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly canonical_request_hash: string;
  readonly evolution_case_ref: string;
  readonly evidence_refs: readonly string[];
  readonly predicted_impact_graph_ref: string | null;
  readonly verified_impact_graph_ref: string | null;
  readonly domain_state_ref: string;
  readonly domain_state_hash: string;
  readonly component_owner_receipt_refs: readonly string[];
  readonly trial_pointer_ref: string | null;
  readonly evaluation_ref: string | null;
  readonly previous_receipt_ref: string | null;
  readonly stable_error_code: string | null;
}
export interface P3Response<R extends JsonObject = JsonObject> {
  readonly outcome_type: "Response";
  readonly runtime_result: R;
  readonly stable_error?: never;
  readonly execution_receipt: EvolutionReceipt | null;
  readonly evidence_ref: string | null;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface P3ErrorResponse {
  readonly outcome_type: "StableError";
  readonly runtime_result?: never;
  readonly stable_error: StableErrorWire;
  readonly execution_receipt: EvolutionReceipt | null;
  readonly evidence_ref: string | null;
  readonly trace_id: string;
  readonly request_id: string;
}
export type P3Result<R extends JsonObject = JsonObject> = P3Response<R> | P3ErrorResponse;

export class P3Fault extends Error {
  constructor(readonly code: string, message: string, readonly retriable = false) {
    super(message); this.name = "P3Fault";
  }
}

function normalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((v) => normalize(v)) as readonly JsonValue[];
  if (value !== null && typeof value === "object") {
    const src = value as Readonly<Record<string, JsonValue>>;
    const out: Record<string, JsonValue> = {};
    for (const k of Object.keys(src).sort()) out[k] = normalize(src[k]!);
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new P3Fault("P3_INVALID_CANONICAL_JSON", "non-finite numbers are forbidden");
  return value;
}

/** RFC8785 JCS-compatible for the JSON value domain used by P3. */
export function canonicalJcs(value: JsonValue): string { return JSON.stringify(normalize(value)); }
export function sha256Jcs(value: JsonValue): string {
  return `sha256:${createHash("sha256").update(canonicalJcs(value), "utf8").digest("hex")}`;
}
export function sha256Text(value: string): string { return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`; }
export function asObject(value: JsonValue | undefined, field: string): JsonObject {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) throw new P3Fault("P3_REQUEST_INVALID", `${field} must be an object`);
  return value as JsonObject;
}
export function asString(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new P3Fault("P3_REQUEST_INVALID", `${field} must be a non-empty string`);
  return value;
}
export function asInteger(value: JsonValue | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new P3Fault("P3_REQUEST_INVALID", `${field} must be an integer`);
  return value;
}
export function asStringArray(value: JsonValue | undefined, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || v.length === 0)) throw new P3Fault("P3_REQUEST_INVALID", `${field} must be a string array`);
  return value as readonly string[];
}
export function requireFields(input: JsonObject, fields: readonly string[], code: string): void {
  for (const f of fields) if (!(f in input) || input[f] === null || input[f] === "") throw new P3Fault(code, `missing required field: ${f}`);
}
export function forbidFields(input: JsonObject, fields: readonly string[], code: string): void {
  for (const f of fields) if (f in input) throw new P3Fault(code, `forbidden field: ${f}`);
}
export function response<R extends JsonObject>(call: P3Call, runtime_result: R, execution_receipt: EvolutionReceipt | null, evidence_ref: string | null = null): P3Response<R> {
  return Object.freeze({ outcome_type: "Response" as const, runtime_result: Object.freeze({ ...runtime_result }) as R, execution_receipt, evidence_ref, trace_id: call.trace_id, request_id: call.request_id });
}
export function stableError(call: Pick<P3Call, "trace_id" | "request_id">, code: string, message: string, retriable = false, receipt: EvolutionReceipt | null = null): P3ErrorResponse {
  return Object.freeze({ outcome_type: "StableError" as const, stable_error: Object.freeze({ code, message, category: code, retriable, trace_id: call.trace_id, request_id: call.request_id }), execution_receipt: receipt, evidence_ref: null, trace_id: call.trace_id, request_id: call.request_id });
}
export async function failClosed<R extends JsonObject>(call: P3Call, allowedCodes: readonly string[], fn: () => Promise<P3Response<R>>): Promise<P3Result<R>> {
  try { return await fn(); }
  catch (error) {
    if (error instanceof P3Fault) {
      const code = allowedCodes.includes(error.code) ? error.code : allowedCodes[allowedCodes.length - 1];
      if (code !== undefined) return stableError(call, code, error.message, error.retriable);
    }
    const fallback = allowedCodes[allowedCodes.length - 1];
    if (fallback === undefined) throw error;
    return stableError(call, fallback, error instanceof Error ? error.message : "P3 operation failed");
  }
}
export function assertP3Envelope(call: P3Call, operationId: string): void {
  if (call.operation_id !== operationId) throw new P3Fault("P3_REQUEST_INVALID", `operation_id must be ${operationId}`);
  asString(call.route_key, "route_key"); asString(call.trace_id, "trace_id"); asString(call.request_id, "request_id");
  asString(call.operation_contract, "operation_contract"); asString(call.receipt_contract_ref, "receipt_contract_ref");
  if (!Array.isArray(call.policy_refs)) throw new P3Fault("P3_REQUEST_INVALID", "policy_refs must be an array");
}
