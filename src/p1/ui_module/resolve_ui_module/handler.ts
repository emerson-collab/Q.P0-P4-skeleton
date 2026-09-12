import { createHash } from "node:crypto";
import { register_business_operation } from "../../business_runtime/business_operation_registry.ts";

export type JsonObject = Readonly<Record<string, unknown>>;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const SUBJECT_KIND_MAPPING = Object.freeze({ RESOURCE: "RESOURCE_VIEW_MODEL", TASK: "TASK_VIEW_MODEL", CONTEXT: "CONTEXT_VIEW_MODEL" } as const);
const PLACEMENT_MAPPING = Object.freeze({ COLLECTION: "COLLECTION_VIEW", DETAIL: "DETAIL_VIEW", PRIMARY_ACTION: "PRIMARY_ACTION", SECONDARY_ACTION: "SECONDARY_ACTION", OVERFLOW_ACTION: "OVERFLOW_ACTION", FLOW: "FLOW_ACTION", STATUS: "STATUS_VIEW", SYSTEM: "SYSTEM_VIEW" } as const);
const REQUEST_CONTROL_MAPPING = Object.freeze({ enum: "SELECT_INPUT", string: "TEXT_INPUT", integer: "NUMBER_INPUT", number: "NUMBER_INPUT", boolean: "BOOLEAN_INPUT", array: "COLLECTION_INPUT", object: "STRUCTURED_INPUT" } as const);
const RESPONSE_VIEW_MAPPING = Object.freeze({ enum: "VALUE_VIEW", string: "VALUE_VIEW", integer: "VALUE_VIEW", number: "VALUE_VIEW", boolean: "VALUE_VIEW", array: "COLLECTION_VIEW", object: "STRUCTURED_VIEW" } as const);

type StableCase = "framework lineage unresolved" | "framework input invalid";
class UiModuleCompileError extends Error { constructor(readonly semantic_case: StableCase, message: string) { super(message); this.name = "UiModuleCompileError"; } }
function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function objectValue(value: unknown, field: string): Record<string, unknown> { if (!isObject(value)) throw new UiModuleCompileError("framework input invalid", `${field} must be object`); return value; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new UiModuleCompileError("framework input invalid", `${field} must be non-empty string`); return value; }
function hashValue(value: unknown, field: string): string { const text = stringValue(value, field); if (!SHA256.test(text)) throw new UiModuleCompileError("framework input invalid", `${field} must be sha256`); return text; }
function arrayValue(value: unknown, field: string): readonly unknown[] { if (!Array.isArray(value)) throw new UiModuleCompileError("framework input invalid", `${field} must be array`); return value; }
function stableClone(value: unknown): unknown { if (Array.isArray(value)) return Object.freeze(value.map(stableClone)); if (isObject(value)) { const out: Record<string, unknown> = {}; for (const key of Object.keys(value).sort()) out[key] = stableClone(value[key]); return Object.freeze(out); } return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`; }
function stableError(trace_id: string, request_id: string, semantic_case: StableCase) { const stable_error = Object.freeze({ case: semantic_case }); return Object.freeze({ outcome_type: "stable_error" as const, stable_error, evidence_ref: sha256Json({ operation_ref: OPERATION_REF, stable_error, trace_id, request_id }), trace_id, request_id }); }

export const CAPABILITY_ID = "ui_module" as const;
export const CAPABILITY_CONTRACT_REF = "Q.UI.CONTRACT.CAPABILITY.UI_MODULE@V0108" as const;
export const OPERATION_ID = "resolve_ui_module" as const;
export const OPERATION_REF = `${CAPABILITY_CONTRACT_REF}#/operations/${OPERATION_ID}` as const;
export interface UiModuleArtifact { readonly ui_module_ref: string; readonly source_capability_ref: string; readonly projection_ref: string; readonly semantic_model: unknown; readonly action_bindings: readonly unknown[]; readonly state_bindings: readonly unknown[]; readonly evidence_views: readonly unknown[]; readonly content_hash: string; }

function exactSchemaType(schema: Record<string, unknown>, field: string): keyof typeof REQUEST_CONTROL_MAPPING {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "enum";
  const declared = schema.type;
  if (typeof declared === "string") {
    if (!(declared in REQUEST_CONTROL_MAPPING)) throw new UiModuleCompileError("framework input invalid", `${field}.type unsupported`);
    return declared as keyof typeof REQUEST_CONTROL_MAPPING;
  }
  if (Array.isArray(declared)) {
    const nonNull = declared.filter((v): v is string => typeof v === "string" && v !== "null");
    if (nonNull.length !== 1 || !(nonNull[0]! in REQUEST_CONTROL_MAPPING)) throw new UiModuleCompileError("framework input invalid", `${field}.type ambiguous`);
    return nonNull[0]! as keyof typeof REQUEST_CONTROL_MAPPING;
  }
  throw new UiModuleCompileError("framework input invalid", `${field}.type missing`);
}
function fieldProjection(schemaValue: unknown, kind: "request" | "response", field: string): readonly unknown[] {
  const schema = objectValue(schemaValue, field);
  if (schema.type !== "object") throw new UiModuleCompileError("framework input invalid", `${field}.type must be object`);
  const properties = objectValue(schema.properties, `${field}.properties`);
  const requiredValues = schema.required === undefined ? [] : arrayValue(schema.required, `${field}.required`).map((v, i) => stringValue(v, `${field}.required[${i}]`));
  const required = new Set(requiredValues);
  return Object.freeze(Object.entries(properties).map(([fieldName, descriptorValue], index) => {
    const descriptor = objectValue(descriptorValue, `${field}.properties.${fieldName}`);
    const schemaType = exactSchemaType(descriptor, `${field}.properties.${fieldName}`);
    const common: Record<string, unknown> = { field_name: fieldName, ordinal_position: index + 1, required: required.has(fieldName), source_schema_type: schemaType };
    if (Array.isArray(descriptor.enum)) common.enum_values = Object.freeze(descriptor.enum.map(stableClone));
    if (kind === "request") common.control_kind = REQUEST_CONTROL_MAPPING[schemaType];
    else common.view_kind = RESPONSE_VIEW_MAPPING[schemaType];
    return Object.freeze(common);
  }));
}
function contractByRef(contracts: Record<string, unknown>, ref: string): Record<string, unknown> {
  const matches = Object.values(contracts).filter((value) => isObject(value) && value.contract_ref === ref) as Record<string, unknown>[];
  if (matches.length !== 1) throw new UiModuleCompileError("framework lineage unresolved", `contract ref ${ref} must resolve exactly once`);
  return matches[0]!;
}
function operationByRef(operations: Record<string, unknown>, ref: string): readonly [string, Record<string, unknown>] {
  const matches = Object.entries(operations).filter(([, value]) => isObject(value) && value.operation_ref === ref) as [string, Record<string, unknown>][];
  if (matches.length !== 1) throw new UiModuleCompileError("framework lineage unresolved", `operation ref ${ref} must resolve exactly once`);
  return matches[0]!;
}

export async function handler(input: unknown): Promise<unknown> {
  let trace_id = "unknown"; let request_id = "unknown";
  try {
    const request = objectValue(input, "input");
    const source_capability_ref = stringValue(request.source_capability_ref, "source_capability_ref");
    const projection_ref = stringValue(request.projection_ref, "projection_ref");
    trace_id = stringValue(request.trace_id, "trace_id"); request_id = stringValue(request.request_id, "request_id");
    const p = objectValue(request.projection_input, "projection_input");
    const framework_artifact_ref = stringValue(p.framework_artifact_ref, "projection_input.framework_artifact_ref");
    const framework_artifact_hash = hashValue(p.framework_artifact_hash, "projection_input.framework_artifact_hash");
    const spec = objectValue(p.capability_presentation_specification, "projection_input.capability_presentation_specification");
    const moduleRequirement = objectValue(p.ui_module_instance_requirement, "projection_input.ui_module_instance_requirement");
    const sourceContractRef = stringValue(p.source_capability_contract_ref, "projection_input.source_capability_contract_ref");
    const sourceContractHash = hashValue(p.source_capability_contract_hash, "projection_input.source_capability_contract_hash");
    const source = objectValue(p.source_capability_semantic_projection, "projection_input.source_capability_semantic_projection");
    const operations = objectValue(source.operations, "source.operations"); const contracts = objectValue(source.contracts, "source.contracts");
    const payloadBindings = objectValue(source.payload_schema_bindings, "source.payload_schema_bindings"); objectValue(source.business_object_ownership, "source.business_object_ownership");
    if (spec.source_capability_ref !== source_capability_ref || moduleRequirement.source_capability_ref !== source_capability_ref) throw new UiModuleCompileError("framework lineage unresolved", "source capability lineage mismatch");
    if (moduleRequirement.q_ui_contract_ref !== CAPABILITY_CONTRACT_REF) throw new UiModuleCompileError("framework lineage unresolved", "ui_module_instance_requirement must bind CURRENT UI_MODULE");
    const subjects = arrayValue(spec.presentation_subjects, "presentation_subjects").map((value, index) => {
      const subject = objectValue(value, `presentation_subjects[${index}]`); const kind = stringValue(subject.subject_kind, `presentation_subjects[${index}].subject_kind`) as keyof typeof SUBJECT_KIND_MAPPING;
      if (!(kind in SUBJECT_KIND_MAPPING)) throw new UiModuleCompileError("framework input invalid", "unsupported subject_kind");
      return Object.freeze({ presentation_subject_ref: stringValue(subject.presentation_subject_ref, `presentation_subjects[${index}].presentation_subject_ref`), subject_kind: kind, model_kind: SUBJECT_KIND_MAPPING[kind], source_semantic_refs: Object.freeze(arrayValue(subject.source_semantic_refs, `presentation_subjects[${index}].source_semantic_refs`).map((x,i)=>stringValue(x,`source_semantic_refs[${i}]`))) });
    });
    const subjectRefs = new Set(subjects.map((s) => s.presentation_subject_ref));
    const operationModels: unknown[] = []; const actionBindings: unknown[] = [];
    for (const [index, value] of arrayValue(spec.operation_presentation_bindings, "operation_presentation_bindings").entries()) {
      const binding = objectValue(value, `operation_presentation_bindings[${index}]`); const opRef = stringValue(binding.source_operation_ref, `operation_presentation_bindings[${index}].source_operation_ref`); const disposition = stringValue(binding.disposition, `operation_presentation_bindings[${index}].disposition`);
      const [operationId] = operationByRef(operations, opRef);
      const model: Record<string, unknown> = { source_operation_ref: opRef, operation_id: operationId, disposition };
      if (disposition === "BACKGROUND") { model.background_reason = stringValue(binding.background_reason, "background_reason"); operationModels.push(Object.freeze(model)); continue; }
      if (disposition === "NOT_APPLICABLE") { model.not_applicable_reason = stringValue(binding.not_applicable_reason, "not_applicable_reason"); operationModels.push(Object.freeze(model)); continue; }
      if (disposition !== "USER_PRESENTED" && disposition !== "SYSTEM_PRESENTED") throw new UiModuleCompileError("framework input invalid", "unsupported disposition");
      const subjectRef = stringValue(binding.presentation_subject_ref, "presentation_subject_ref"); if (!subjectRefs.has(subjectRef)) throw new UiModuleCompileError("framework lineage unresolved", "operation subject unresolved");
      const placementIntent = stringValue(binding.placement_intent, "placement_intent") as keyof typeof PLACEMENT_MAPPING; if (!(placementIntent in PLACEMENT_MAPPING)) throw new UiModuleCompileError("framework input invalid", "unsupported placement_intent");
      Object.assign(model, { presentation_subject_ref: subjectRef, placement_intent: placementIntent, placement_kind: PLACEMENT_MAPPING[placementIntent], exact_action_binding_ref: stringValue(binding.exact_action_binding_ref, "exact_action_binding_ref") });
      if (binding.action_scope !== undefined) model.action_scope = stringValue(binding.action_scope, "action_scope"); if (binding.visibility_intent !== undefined) model.visibility_intent = stringValue(binding.visibility_intent, "visibility_intent");
      const action: Record<string, unknown> = { source_operation_ref: opRef, presentation_subject_ref: subjectRef, placement_intent: placementIntent, placement_kind: PLACEMENT_MAPPING[placementIntent], exact_action_binding_ref: model.exact_action_binding_ref, interaction_kind: disposition === "USER_PRESENTED" ? "USER" : "SYSTEM" };
      if (model.action_scope !== undefined) action.action_scope = model.action_scope; if (model.visibility_intent !== undefined) action.visibility_intent = model.visibility_intent;
      if (disposition === "USER_PRESENTED") {
        const pb = objectValue(payloadBindings[operationId], `payload_schema_bindings.${operationId}`);
        const requestRef = stringValue(pb.request_contract_ref, "request_contract_ref"); const responseRef = stringValue(pb.response_contract_ref, "response_contract_ref");
        const reqContract = contractByRef(contracts, requestRef); const resContract = contractByRef(contracts, responseRef);
        action.request_contract_ref = requestRef; action.response_contract_ref = responseRef;
        action.controls = fieldProjection(reqContract.input_schema, "request", `${operationId}.input_schema`);
        action.response_views = fieldProjection(resContract.runtime_result_schema, "response", `${operationId}.runtime_result_schema`);
      } else { action.controls = Object.freeze([]); action.response_views = Object.freeze([]); }
      actionBindings.push(Object.freeze(action)); operationModels.push(Object.freeze(model));
    }
    const stateBindings: unknown[] = [];
    if (source.state_model !== undefined) {
      const sm = objectValue(source.state_model, "source.state_model"); const states = sm.allowed_business_states === undefined ? [] : arrayValue(sm.allowed_business_states, "state_model.allowed_business_states");
      states.forEach((value,index)=>stateBindings.push(Object.freeze({ state_name: stringValue(value,`allowed_business_states[${index}]`), source_capability_ref })));
    }
    let evidenceViews: readonly unknown[] = Object.freeze([]);
    if (isObject(spec.presentation_requirements) && spec.presentation_requirements.evidence_views !== undefined) evidenceViews = Object.freeze(arrayValue(spec.presentation_requirements.evidence_views, "presentation_requirements.evidence_views").map(stableClone));
    const semantic_model = Object.freeze({ version: "Q_UI_MODULE_SEMANTIC_MODEL_V1", framework_artifact_ref, framework_artifact_hash, source_capability_contract_ref: sourceContractRef, source_capability_contract_hash: sourceContractHash, subjects: Object.freeze(subjects), operations: Object.freeze(operationModels) });
    const artifactBody = stableClone({ ui_module_ref: projection_ref, source_capability_ref, projection_ref, semantic_model, action_bindings: Object.freeze(actionBindings), state_bindings: Object.freeze(stateBindings), evidence_views: evidenceViews }) as JsonObject;
    const ui_module_artifact = Object.freeze({ ...artifactBody, content_hash: sha256Json(artifactBody) }) as UiModuleArtifact;
    const evidence_ref = sha256Json({ operation_ref: OPERATION_REF, ui_module_artifact, trace_id, request_id }); const receipt_ref = sha256Json({ operation_ref: OPERATION_REF, outcome_type: "response", ui_module_artifact, evidence_ref, trace_id, request_id });
    return Object.freeze({ outcome_type: "response" as const, ui_module_artifact, evidence_ref, receipt_ref, trace_id, request_id });
  } catch (error) { return stableError(trace_id, request_id, error instanceof UiModuleCompileError ? error.semantic_case : "framework input invalid"); }
}
register_business_operation(OPERATION_REF, handler);
