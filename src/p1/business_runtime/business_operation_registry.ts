import { createHash } from "node:crypto";
import { P0_CONTRACT_REF, P0_PROVIDER_SYMBOL_REF, StableRuntimeError, deep_freeze, exact_ref, normalize_runtime_error } from "#q/p0/runtime_contract";
import { runtime_provider } from "#q/p0/stage_handler";
import type { HookBinding, HookEvidence, RuntimeContext, RuntimeOperation, RuntimeInvokeResult, StableRuntimeErrorShape, StageExtensionContract } from "#q/p0/runtime_contract";
import {
  P1_CAPABILITY_GENERAL_SLOT_IDS,
  P1_CAPABILITY_GENERAL_SLOT_REFS,
  P1_RUNTIME_SLOT_REFS,
  P1_CONTRACT_REF,
  create_p1_capability_stage_extension,
  resolve_p1_framework_anchor,
} from "./stage_extension_contract.ts";
import type {
  P1CapabilityGeneralSlotId,
  P1CapabilityGeneralSlotProjection,
} from "./stage_extension_contract.ts";

export type P1StaticRuntimeSlotId =
  | "manifest" | "qreg" | "qconfig" | "operation_contract" | "policy_refs" | "hook_binding_refs";

export type P1StaticRuntimeSlotProjection = Readonly<Record<
  P1StaticRuntimeSlotId, Readonly<{ slot_ref: string; value: unknown }>
>>;

export interface P1RuleEvidence {
  readonly rule_ref: string;
  readonly result: "PASS" | "FAIL";
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly operation_ref: string;
  readonly observation: Readonly<Record<string, unknown>>;
}

export interface P1ExecutionReceipt {
  readonly operation_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly outcome_type: "response" | "stable_error";
  readonly operation_attempt: 0 | 1;
  readonly operation_attempts: 0 | 1;
  readonly hook_evidence: readonly HookEvidence[];
  readonly rule_evidence: readonly P1RuleEvidence[];
}

export interface BusinessOperationSuccess {
  readonly outcome_type: "response";
  readonly runtime_result: unknown;
  readonly trace_id: string;
  readonly request_id: string;
  readonly execution_receipt: P1ExecutionReceipt;
}
export interface BusinessOperationFailure {
  readonly outcome_type: "stable_error";
  readonly stable_error: StableRuntimeErrorShape;
  readonly trace_id: string;
  readonly request_id: string;
  readonly execution_receipt?: P1ExecutionReceipt;
}
export type BusinessOperationOutcome = BusinessOperationSuccess | BusinessOperationFailure;

export type BusinessOperationHandler = RuntimeOperation<unknown, unknown>;
export type BusinessEventInterfaceKind = "EVENT_PUBLISH" | "EVENT_CONSUME";

export interface BusinessOperationRouteBinding {
  readonly route_key: string;
  readonly capability_contract_ref: string;
  readonly capability_id: string;
  readonly operation_id: string;
  readonly operation_ref: string;
}

export interface BusinessInternalOperationBinding {
  readonly capability_contract_ref: string;
  readonly capability_id: string;
  readonly operation_id: string;
  readonly operation_ref: string;
}

export interface BusinessOperationInvokePath {
  readonly route_key: string;
  readonly capability_id: string;
  readonly operation_id: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface BusinessInternalCallRequest {
  readonly local_route_key: string;
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
  readonly call_path: readonly string[];
  readonly call_depth: number;
  readonly trace_id: string;
  readonly parent_request_id: string;
}

export interface BusinessInternalCallSuccess {
  readonly outcome_type: "response";
  readonly runtime_result: unknown;
  readonly child_call_path: readonly string[];
  readonly child_call_depth: number;
  readonly trace_id: string;
  readonly child_request_id: string;
  readonly execution_receipt?: P1ExecutionReceipt;
}

export interface BusinessInternalCallFailure {
  readonly outcome_type: "stable_error";
  readonly stable_error: StableRuntimeErrorShape;
  readonly trace_id: string;
  readonly child_request_id: string;
  readonly execution_receipt?: P1ExecutionReceipt;
}

export type BusinessInternalCallOutcome =
  | BusinessInternalCallSuccess
  | BusinessInternalCallFailure;

export interface BusinessRegistryEntry {
  readonly object_ref: string;
  readonly object_contract: unknown;
  readonly registry_rule: unknown;
}

export interface BusinessEventInterfaceBinding {
  readonly capability_contract_ref: string;
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly surface: "EVENT";
  readonly kind: BusinessEventInterfaceKind;
  readonly method_ref: "publish_business_event" | "consume_business_event";
}

export interface BusinessEventPublishRequest {
  readonly subject_ref: string;
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface BusinessEventPublisher {
  publish(request: Readonly<BusinessEventPublishRequest>): unknown | Promise<unknown>;
}

export interface P1EventExecutionReceipt {
  readonly subject_ref: string;
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly outcome_type: "response";
  readonly owner_execution_receipt: P1ExecutionReceipt;
}

export interface BusinessEventSuccess {
  readonly outcome_type: "response";
  readonly subject_ref: string;
  readonly runtime_result: unknown;
  readonly execution_receipt: P1EventExecutionReceipt;
  readonly evidence_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface BusinessEventFailure {
  readonly outcome_type: "stable_error";
  readonly subject_ref: string;
  readonly stable_error: StableRuntimeErrorShape;
  readonly trace_id: string;
  readonly request_id: string;
}

export type BusinessEventOutcome = BusinessEventSuccess | BusinessEventFailure;

interface RegisteredBusinessOperation {
  readonly route: BusinessOperationRouteBinding;
  readonly handler: BusinessOperationHandler;
  readonly stage_extension: StageExtensionContract;
  readonly static_runtime_slots?: P1StaticRuntimeSlotProjection;
}

const operations = new Map<string, RegisteredBusinessOperation>();
const business_objects = new Map<string, BusinessRegistryEntry>();
const event_interfaces = new Map<string, BusinessEventInterfaceBinding>();
const completed_p1_receipts = new WeakSet<P1ExecutionReceipt>();

function nonEmptyString(value: string, field: string): string {
  if (value.length === 0) {
    throw new StableRuntimeError("P1_BINDING_INVALID", `${field} must be a non-empty string`);
  }
  return value;
}

function exactSlotValue(
  projection: P1CapabilityGeneralSlotProjection,
  slotId: P1CapabilityGeneralSlotId,
): string {
  const binding = projection[slotId];
  if (!binding || binding.slot_ref !== P1_CAPABILITY_GENERAL_SLOT_REFS[slotId]) {
    throw new StableRuntimeError(
      "P1_OVERLAY_SLOT_INVALID",
      `${slotId} must bind the exact predeclared P1 V0186 slot_ref`,
    );
  }
  return nonEmptyString(binding.value, slotId);
}

function exactStaticRuntimeSlot(
  slots: P1StaticRuntimeSlotProjection,
  id: P1StaticRuntimeSlotId,
): unknown {
  const binding = slots[id];
  if (binding === undefined || binding.slot_ref !== P1_RUNTIME_SLOT_REFS[id]) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", `${id} must bind its exact V0186 P1 runtime slot_ref`);
  }
  if (binding.value === undefined) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", `${id} requires its governed runtime projection value`);
  }
  return binding.value;
}

function staticRefList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((ref: unknown) => typeof ref !== "string" || !exact_ref(ref))) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", `${field} must be an array of exact governed refs`);
  }
  return deep_freeze([...value] as string[]);
}

function exactGeneralSlotProjection(projection: P1CapabilityGeneralSlotProjection): void {
  const keys = Object.keys(projection);
  if (
    keys.length !== P1_CAPABILITY_GENERAL_SLOT_IDS.length
    || keys.some((key) => !P1_CAPABILITY_GENERAL_SLOT_IDS.includes(key as P1CapabilityGeneralSlotId))
  ) {
    throw new StableRuntimeError(
      "P1_OVERLAY_SLOT_INVALID",
      "GENERAL overlay must contain exactly thirteen declared V0186 slot identities",
    );
  }
  for (const id of P1_CAPABILITY_GENERAL_SLOT_IDS) exactSlotValue(projection, id);
}

function createRegisteredStageExtension(
  projection: P1CapabilityGeneralSlotProjection,
  staticSlots: P1StaticRuntimeSlotProjection,
): StageExtensionContract {
  exactGeneralSlotProjection(projection);
  const allowedStaticSlots = [
    "manifest", "qreg", "qconfig", "operation_contract", "policy_refs", "hook_binding_refs",
  ] as const;
  const actualSlotIds = Object.keys(staticSlots);
  if (
    actualSlotIds.length !== allowedStaticSlots.length
    || actualSlotIds.some((id) => !allowedStaticSlots.includes(id as P1StaticRuntimeSlotId))
  ) {
    throw new StableRuntimeError(
      "P1_OVERLAY_SLOT_INVALID",
      "STATIC_OVERLAY_BIND accepts exactly the six declared P1_STATIC_RUNTIME_PROJECTION slots",
    );
  }
  for (const id of [
    "manifest", "qreg", "qconfig", "operation_contract", "policy_refs", "hook_binding_refs",
  ] as const) exactStaticRuntimeSlot(staticSlots, id);
  if (exactStaticRuntimeSlot(staticSlots, "operation_contract") !== exactSlotValue(projection, "operation_ref")) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", "operation_contract must project the exact bound operation_ref");
  }
  staticRefList(exactStaticRuntimeSlot(staticSlots, "policy_refs"), "policy_refs");
  const hookBindingRefs = staticRefList(exactStaticRuntimeSlot(staticSlots, "hook_binding_refs"), "hook_binding_refs");
  const registry = exactStaticRuntimeSlot(staticSlots, "qreg");
  if (registry === null || typeof registry !== "object" || Array.isArray(registry)) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", "qreg must be an exact static Operation/Interface registry projection");
  }
  const qreg = registry as Readonly<Record<string, unknown>>;
  const operationRefs = staticRefList(qreg.operation_refs, "qreg.operation_refs");
  const interfaceRefs = staticRefList(qreg.interface_refs, "qreg.interface_refs");
  if (!operationRefs.includes(exactSlotValue(projection, "operation_ref"))
    || !interfaceRefs.includes(exactSlotValue(projection, "interface_ref"))) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID",
      "P1 qreg must contain the exact bound Operation and Interface refs");
  }
  return create_p1_capability_stage_extension({
    general_slots: projection,
    implementation_ref: exactSlotValue(projection, "capability_contract_ref"),
    provided_interface_refs: interfaceRefs,
    hook_binding_refs: hookBindingRefs,
  });
}

function operationRouteFromProjection(
  projection: P1CapabilityGeneralSlotProjection,
): BusinessOperationRouteBinding {
  const capabilityContractRef = exactSlotValue(projection, "capability_contract_ref");
  const capabilityId = exactSlotValue(projection, "capability_id");
  const operationId = exactSlotValue(projection, "operation_id");
  const operationRef = exactSlotValue(projection, "operation_ref");

  if (!exact_ref(capabilityContractRef) || capabilityContractRef.includes("#/")) {
    throw new StableRuntimeError(
      "P1_OVERLAY_SLOT_INVALID",
      "capability_contract_ref must be an exact versioned Capability Contract ref",
    );
  }
  if (
    !exact_ref(operationRef)
    || operationRef !== `${capabilityContractRef}#/operations/${operationId}`
  ) {
    throw new StableRuntimeError(
      "P1_OVERLAY_SLOT_INVALID",
      "operation_ref must exactly match capability_contract_ref and operation_id",
    );
  }

  return deep_freeze({
    route_key: operationRef,
    capability_contract_ref: capabilityContractRef,
    capability_id: capabilityId,
    operation_id: operationId,
    operation_ref: operationRef,
  });
}

function registerOperationRoute(
  route: Readonly<BusinessOperationRouteBinding>,
  handler: BusinessOperationHandler,
  extension: StageExtensionContract,
  staticSlots?: P1StaticRuntimeSlotProjection,
): BusinessOperationRouteBinding {
  const existing = operations.get(route.route_key);
  if (existing !== undefined) {
    if (
      existing.handler !== handler
      || existing.route.capability_contract_ref !== route.capability_contract_ref
      || existing.route.capability_id !== route.capability_id
      || existing.route.operation_id !== route.operation_id
      || existing.route.operation_ref !== route.operation_ref
      || JSON.stringify(existing.stage_extension) !== JSON.stringify(extension)
    ) {
      throw new StableRuntimeError("P1_OPERATION_DUPLICATE", "P1-derived route_key already has a different exact Operation binding");
    }
    return existing.route;
  }
  const frozenRoute = deep_freeze({ ...route });
  operations.set(frozenRoute.route_key, deep_freeze({
    route: frozenRoute, handler, stage_extension: extension, ...(staticSlots === undefined ? {} : { static_runtime_slots: staticSlots }),
  }));
  return frozenRoute;
}

export function register_business_operation(
  general_slots: P1CapabilityGeneralSlotProjection,
  handler: BusinessOperationHandler,
  static_runtime_slots: P1StaticRuntimeSlotProjection,
): BusinessOperationRouteBinding {
  if (!static_runtime_slots) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", "every concrete Operation requires exact P1 static runtime slots");
  }
  const extension = createRegisteredStageExtension(general_slots, static_runtime_slots);
  resolve_p1_framework_anchor({
    surface: exactSlotValue(general_slots, "surface"),
    kind: exactSlotValue(general_slots, "kind"),
    method_ref: exactSlotValue(general_slots, "method_ref"),
  });
  return registerOperationRoute(operationRouteFromProjection(general_slots), handler, extension, static_runtime_slots);
}

/**
 * Internal-only Operation: no invented concrete Interface identity.
 * It still binds P0's existing StageExtension and sole RuntimeProvider.
 */
export function register_internal_business_operation(
  binding: Readonly<BusinessInternalOperationBinding>,
  handler: BusinessOperationHandler,
): BusinessOperationRouteBinding {
  const capabilityContractRef = nonEmptyString(binding.capability_contract_ref, "capability_contract_ref");
  const capabilityId = nonEmptyString(binding.capability_id, "capability_id");
  const operationId = nonEmptyString(binding.operation_id, "operation_id");
  const operationRef = nonEmptyString(binding.operation_ref, "operation_ref");
  if (!exact_ref(capabilityContractRef) || capabilityContractRef.includes("#/")) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", "internal capability_contract_ref must be one exact versioned Capability Contract ref");
  }
  if (!exact_ref(operationRef) || operationRef !== `${capabilityContractRef}#/operations/${operationId}`) {
    throw new StableRuntimeError("P1_OVERLAY_SLOT_INVALID", "internal operation_ref must exactly match capability_contract_ref and operation_id");
  }
  const extension: StageExtensionContract = deep_freeze({
    stage_id: "P1",
    stage_role: "NONE",
    stage_contract_ref: P1_CONTRACT_REF,
    implementation_ref: capabilityContractRef,
    provided_interface_refs: [],
    consumed_interface_refs: [`${P0_CONTRACT_REF}#/interfaces/runtime_execution_invoke`],
    hook_consumer_refs: [],
    hook_binding_refs: [],
    port_refs: [],
    upstream_runtime_ref: P0_CONTRACT_REF,
    runtime_provider_symbol_ref: P0_PROVIDER_SYMBOL_REF,
    status: "active",
    rule_version_ref: P1_CONTRACT_REF,
  });
  return registerOperationRoute(deep_freeze({
    route_key: operationRef,
    capability_contract_ref: capabilityContractRef,
    capability_id: capabilityId,
    operation_id: operationId,
    operation_ref: operationRef,
  }), handler, extension);
}

function resolveRegisteredOperationByExactRef(operationRef: string): RegisteredBusinessOperation {
  const registered = operations.get(operationRef);
  if (
    registered === undefined
    || registered.route.route_key !== operationRef
    || registered.route.operation_ref !== operationRef
  ) {
    throw new StableRuntimeError(
      "P1_OPERATION_NOT_REGISTERED",
      "Exact Operation ref is not registered as its P1-derived route_key",
    );
  }
  return registered;
}

function resolveRegisteredOperationByPath(
  path: Readonly<BusinessOperationInvokePath>,
): RegisteredBusinessOperation {
  const routeKey = nonEmptyString(path.route_key, "route_key");
  const registered = operations.get(routeKey);
  if (
    registered === undefined
    || registered.route.route_key !== registered.route.operation_ref
    || routeKey !== registered.route.operation_ref
    || path.capability_id !== registered.route.capability_id
    || path.operation_id !== registered.route.operation_id
  ) {
    throw new StableRuntimeError(
      "P1_OPERATION_ROUTE_MISMATCH",
      "P1 route tuple does not resolve exactly one registered Operation",
    );
  }
  return registered;
}

export function resolve_business_operation(
  path: Readonly<BusinessOperationInvokePath>,
): BusinessOperationHandler {
  return resolveRegisteredOperationByPath(path).handler;
}

function canonicalEvidenceJson(value: unknown): string {
  const sorted = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sorted);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .filter(([,v]) => v !== undefined)
        .sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k,v]) => [k, sorted(v)]));
    }
    return input;
  };
  const encoded = JSON.stringify(sorted(value));
  if (typeof encoded !== "string") {
    throw new StableRuntimeError("P1_BINDING_INVALID", "Rule evidence requires canonical JSON material");
  }
  return encoded;
}

function ruleEvidence(
  ruleId: string,
  result: "PASS" | "FAIL",
  operationRef: string,
  traceId: string,
  requestId: string,
  observation: Readonly<Record<string, unknown>>,
): P1RuleEvidence {
  const evidence_ref = `sha256:${createHash("sha256").update(canonicalEvidenceJson(observation), "utf8").digest("hex")}`;
  return deep_freeze({
    rule_ref: `${P1_CONTRACT_REF}#/contract_rule_set/rules/${ruleId}`,
    result, evidence_ref, trace_id: traceId, request_id: requestId,
    operation_ref: operationRef, observation: deep_freeze({ ...observation }),
  });
}

function finalizedReceipt(
  route: BusinessOperationRouteBinding,
  p0: RuntimeInvokeResult<unknown>,
  outcomeType: "response" | "stable_error",
): P1ExecutionReceipt {
  // P0 controls actual invocation attempts and hook evidence. P1 only projects its outcome/receipt.
  const base = { operation_ref: route.operation_ref, trace_id: p0.trace_id, request_id: p0.request_id };
  const rule_evidence = deep_freeze([
    ruleEvidence("P1-OP-103", "PASS", route.operation_ref, p0.trace_id, p0.request_id,
      { exact_route_key: route.route_key, route_matches_operation: route.route_key === route.operation_ref }),
    ruleEvidence("P1-OP-104", p0.operation_attempts <= 1 ? "PASS" : "FAIL",
      route.operation_ref, p0.trace_id, p0.request_id, { operation_attempts: p0.operation_attempts }),
    // Authorization is Capability-owned; a generic P0 hook snapshot cannot certify business authorization.
    ruleEvidence("P1-OP-105", "FAIL", route.operation_ref, p0.trace_id, p0.request_id,
      { authorization_evidence_not_supplied_by_generic_skeleton: true }),
    ruleEvidence("P1-OP-106", "PASS", route.operation_ref, p0.trace_id, p0.request_id,
      { outcome_finalized_before_receipt: true }),
    ruleEvidence("P1-OP-107", "PASS", route.operation_ref, p0.trace_id, p0.request_id,
      { finalized_outcome_type: outcomeType }),
  ]);
  const receipt: P1ExecutionReceipt = deep_freeze({
    ...base, outcome_type: outcomeType, operation_attempt: p0.operation_attempts,
    operation_attempts: p0.operation_attempts, hook_evidence: p0.hook_evidence, rule_evidence,
  });
  completed_p1_receipts.add(receipt);
  return receipt;
}

/**
 * P1 PRE_OPERATION validated_context is a route/correlation validation result.
 * The P0 RuntimeContext itself remains P0-owned and is revalidated by P0 M1.
 * No new field, caller-derived route authority or second Runtime is introduced.
 */
function validatedP1Context(
  path: Readonly<BusinessOperationInvokePath>,
  route: Readonly<BusinessOperationRouteBinding>,
  runtime_context: RuntimeContext,
): Readonly<{
  readonly route_key: string;
  readonly operation_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly runtime_context: RuntimeContext;
}> {
  if (runtime_context === null || typeof runtime_context !== "object" || Array.isArray(runtime_context)) {
    throw new StableRuntimeError("P1_OPERATION_ROUTE_MISMATCH", "P0 RuntimeContext must be present for the exact P1 Operation");
  }
  if (
    typeof path.trace_id !== "string" || path.trace_id.length === 0
    || typeof path.request_id !== "string" || path.request_id.length === 0
    || path.trace_id !== runtime_context.trace_id
    || path.request_id !== runtime_context.request_id
    || runtime_context.stage_contract_ref !== P1_CONTRACT_REF
    || runtime_context.operation_ref !== route.operation_ref
    || path.route_key !== route.operation_ref
  ) {
    throw new StableRuntimeError(
      "P1_OPERATION_ROUTE_MISMATCH",
      "P1 validated_context requires exact derived route, Stage, Operation and invocation correlation",
    );
  }
  return Object.freeze({
    route_key: route.operation_ref,
    operation_ref: route.operation_ref,
    trace_id: path.trace_id,
    request_id: path.request_id,
    runtime_context,
  });
}

export async function invoke_business_operation(
  path: Readonly<BusinessOperationInvokePath>,
  input: unknown,
  runtime_context: RuntimeContext,
  hook_binding_set: readonly HookBinding[] = [],
): Promise<BusinessOperationOutcome> {
  try {
    const registered = resolveRegisteredOperationByPath(path);
    const validated_context = validatedP1Context(path, registered.route, runtime_context);
    // P1 validated only P1-owned route/identity/correlation; P0 validates and
    // freezes the existing RuntimeContext at P0_RUNTIME_ENTRY.
    const p0 = await runtime_provider.invoke({
      stage_extension: registered.stage_extension,
      runtime_context: validated_context.runtime_context, input,
      operation: registered.handler,
      hook_binding_set,
    });
    const outcomeType: "response" | "stable_error" = p0.outcome === "success" ? "response" : "stable_error";
    const execution_receipt = finalizedReceipt(registered.route, p0, outcomeType);
    if (p0.outcome === "success") {
      return deep_freeze({
        outcome_type: "response" as const, runtime_result: p0.value,
        trace_id: p0.trace_id, request_id: p0.request_id, execution_receipt,
      });
    }
    const stable_error: StableRuntimeErrorShape = p0.outcome === "error"
      ? p0.error
      : { code: p0.reason, message: "P0 before_process denied the Operation" };
    return deep_freeze({
      outcome_type: "stable_error" as const, stable_error,
      trace_id: p0.trace_id, request_id: p0.request_id, execution_receipt,
    });
  } catch (error) {
    const stable = normalize_runtime_error(error, "P1_OPERATION_ROUTE_MISMATCH");
    return deep_freeze({
      outcome_type: "stable_error" as const,
      stable_error: stable.details === undefined
        ? { code: stable.code, message: stable.message }
        : { code: stable.code, message: stable.message, details: stable.details },
      trace_id: path.trace_id, request_id: path.request_id,
    });
  }
}

function exactInternalCallPath(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new StableRuntimeError(
      "P1_BINDING_INVALID",
      "call_path must be an array of non-empty exact path identities",
    );
  }
  return deep_freeze([...value]);
}

function internalCallStableError(
  error: unknown,
  trace_id: string,
  child_request_id: string,
): BusinessInternalCallFailure {
  const stable = normalize_runtime_error(error, "P1_OPERATION_ROUTE_MISMATCH");
  const stable_error: StableRuntimeErrorShape = stable.details === undefined
    ? { code: stable.code, message: stable.message }
    : { code: stable.code, message: stable.message, details: stable.details };
  return deep_freeze({
    outcome_type: "stable_error" as const,
    stable_error,
    trace_id,
    child_request_id,
  });
}

/**
 * P1 V0186 internal_call_invoke realization.
 *
 * The exact local_route_key is the already-registered Operation ref. The caller does not
 * gain route authority. RuntimeContext.request_id is projected as child_request_id;
 * call_path/call_depth advance exactly one hop. No global maximum call-depth constant is
 * invented here because the governed Source does not define one.
 */
export async function invoke_internal_call(
  request: Readonly<BusinessInternalCallRequest>,
): Promise<BusinessInternalCallOutcome> {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new StableRuntimeError("P1_BINDING_INVALID", "internal call request must be an object");
  }
  const runtimeContext = request.runtime_context;
  if (runtimeContext === null || typeof runtimeContext !== "object" || Array.isArray(runtimeContext)) {
    throw new StableRuntimeError("P1_OPERATION_ROUTE_MISMATCH", "runtime_context must be an exact P0 RuntimeContext object");
  }
  const traceId = nonEmptyString(request.trace_id, "trace_id");
  const parentRequestId = nonEmptyString(request.parent_request_id, "parent_request_id");
  void parentRequestId;
  const childRequestId = nonEmptyString(runtimeContext.request_id, "runtime_context.request_id");
  if (runtimeContext.trace_id !== traceId) {
    throw new StableRuntimeError(
      "P1_OPERATION_ROUTE_MISMATCH",
      "internal call trace_id must equal runtime_context.trace_id",
    );
  }

  let callPath: readonly string[];
  try {
    if (runtimeContext.stage_contract_ref !== P1_CONTRACT_REF) {
      throw new StableRuntimeError("P1_OPERATION_ROUTE_MISMATCH", "internal CALL must originate inside the exact P1 Stage");
    }
    callPath = exactInternalCallPath(request.call_path);
    if (!Number.isSafeInteger(request.call_depth) || request.call_depth < 0) {
      throw new StableRuntimeError(
        "P1_OPERATION_ROUTE_MISMATCH",
        "call_depth must be a non-negative safe integer",
      );
    }
    const localRouteKey = nonEmptyString(request.local_route_key, "local_route_key");
    const registered = resolveRegisteredOperationByExactRef(localRouteKey);
    if (callPath.includes(registered.route.operation_ref)) {
      throw new StableRuntimeError(
        "P1_OPERATION_ROUTE_MISMATCH",
        "internal call target already exists in call_path",
      );
    }
    if (request.call_depth === Number.MAX_SAFE_INTEGER) {
      throw new StableRuntimeError(
        "P1_OPERATION_ROUTE_MISMATCH",
        "child_call_depth cannot be represented as a safe integer",
      );
    }

    const childCallPath = deep_freeze([...callPath, registered.route.operation_ref]);
    const childCallDepth = request.call_depth + 1;
    // The nested invocation has its own bound Operation identity but reuses the
    // exact P0 correlation values. P1 never redefines or bypasses the P0 pipeline.
    const childRuntimeContext: RuntimeContext = deep_freeze({
      ...runtimeContext,
      stage_contract_ref: P1_CONTRACT_REF,
      operation_ref: registered.route.operation_ref,
    });
    const outcome = await invoke_business_operation(
      {
        route_key: registered.route.operation_ref,
        capability_id: registered.route.capability_id,
        operation_id: registered.route.operation_id,
        trace_id: traceId,
        request_id: childRequestId,
      },
      request.input,
      childRuntimeContext,
    );
    if (outcome.outcome_type === "stable_error") {
      return deep_freeze({
        outcome_type: "stable_error" as const,
        stable_error: outcome.stable_error,
        trace_id: traceId,
        child_request_id: childRequestId,
        ...(outcome.execution_receipt === undefined ? {} : { execution_receipt: outcome.execution_receipt }),
      });
    }
    return deep_freeze({
      outcome_type: "response" as const,
      runtime_result: outcome.runtime_result,
      child_call_path: childCallPath,
      child_call_depth: childCallDepth,
      trace_id: traceId,
      child_request_id: childRequestId,
      execution_receipt: outcome.execution_receipt,
    });
  } catch (error) {
    return internalCallStableError(error, traceId, childRequestId);
  }
}

export function registered_business_operation_refs(): readonly string[] {
  return deep_freeze([...operations.values()].map((item) => item.route.operation_ref).sort());
}

export function registered_business_operation_routes(): readonly BusinessOperationRouteBinding[] {
  return deep_freeze(
    [...operations.values()]
      .map((item) => item.route)
      .sort((left, right) => left.route_key.localeCompare(right.route_key)),
  );
}

export function register_business_event_interface(
  general_slots: P1CapabilityGeneralSlotProjection,
): BusinessEventInterfaceBinding {
  const capabilityContractRef = exactSlotValue(general_slots, "capability_contract_ref");
  const interfaceRef = exactSlotValue(general_slots, "interface_ref");
  const operationRef = exactSlotValue(general_slots, "operation_ref");
  const surface = exactSlotValue(general_slots, "surface");
  const kind = exactSlotValue(general_slots, "kind");
  const methodRef = exactSlotValue(general_slots, "method_ref");

  if (!exact_ref(interfaceRef) || !interfaceRef.startsWith(`${capabilityContractRef}#/interfaces/`)) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "interface_ref must be an exact member of capability_contract_ref",
    );
  }

  const registeredOperation = resolveRegisteredOperationByExactRef(operationRef);
  if (
    registeredOperation.route.capability_contract_ref !== capabilityContractRef
    || registeredOperation.route.capability_id !== exactSlotValue(general_slots, "capability_id")
    || registeredOperation.route.operation_id !== exactSlotValue(general_slots, "operation_id")
    || !registeredOperation.stage_extension.provided_interface_refs.includes(interfaceRef)
  ) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "EVENT Interface/Operation tuple must match one predeclared static P1 registry binding",
    );
  }
  if (surface !== "EVENT") {
    throw new StableRuntimeError("P1_EVENT_BINDING_INVALID", "EVENT binding surface must equal EVENT");
  }
  if (kind !== "EVENT_PUBLISH" && kind !== "EVENT_CONSUME") {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "EVENT binding kind must be EVENT_PUBLISH or EVENT_CONSUME",
    );
  }
  const expectedMethodRef = kind === "EVENT_PUBLISH"
    ? "publish_business_event"
    : "consume_business_event";
  if (methodRef !== expectedMethodRef) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      `EVENT ${kind} method_ref must equal ${expectedMethodRef}`,
    );
  }

  const exactBinding = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT" as const,
    kind,
    method_ref: expectedMethodRef,
  } satisfies BusinessEventInterfaceBinding);

  const existing = event_interfaces.get(interfaceRef);
  if (existing !== undefined) {
    if (
      existing.capability_contract_ref !== exactBinding.capability_contract_ref
      || existing.operation_ref !== exactBinding.operation_ref
      || existing.kind !== exactBinding.kind
      || existing.method_ref !== exactBinding.method_ref
    ) {
      throw new StableRuntimeError(
        "P1_EVENT_INTERFACE_DUPLICATE",
        "EVENT interface ref already has a different exact binding",
      );
    }
    return existing;
  }

  event_interfaces.set(interfaceRef, exactBinding);
  return exactBinding;
}

export function resolve_business_event_interface(
  interface_ref: string,
  expected_kind?: BusinessEventInterfaceKind,
): BusinessEventInterfaceBinding {
  const binding = event_interfaces.get(interface_ref);
  if (binding === undefined) {
    throw new StableRuntimeError(
      "P1_EVENT_INTERFACE_NOT_REGISTERED",
      "EVENT interface ref is not registered",
    );
  }
  if (expected_kind !== undefined && binding.kind !== expected_kind) {
    throw new StableRuntimeError(
      "P1_EVENT_INTERFACE_KIND_MISMATCH",
      "EVENT interface kind does not match requested dispatch path",
    );
  }
  return binding;
}

export function registered_business_event_interface_refs(): readonly string[] {
  return deep_freeze([...event_interfaces.keys()].sort());
}

function exactEventError(error: unknown): StableRuntimeErrorShape {
  const normalized = normalize_runtime_error(error, "P1_EVENT_BINDING_INVALID");
  return normalized.details === undefined
    ? { code: normalized.code, message: normalized.message }
    : { code: normalized.code, message: normalized.message, details: normalized.details };
}

function eventReceipt(
  binding: BusinessEventInterfaceBinding,
  subjectRef: string,
  ownerReceipt: P1ExecutionReceipt,
): P1EventExecutionReceipt {
  return deep_freeze({
    subject_ref: subjectRef,
    interface_ref: binding.interface_ref,
    operation_ref: binding.operation_ref,
    trace_id: ownerReceipt.trace_id,
    request_id: ownerReceipt.request_id,
    outcome_type: "response" as const,
    owner_execution_receipt: ownerReceipt,
  });
}

function eventEvidenceRef(receipt: P1EventExecutionReceipt): string {
  return `sha256:${createHash("sha256").update(canonicalEvidenceJson(receipt), "utf8").digest("hex")}`;
}

export async function publish_business_event(
  interface_ref: string,
  subject_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
  owner_execution: BusinessOperationSuccess,
  publisher: BusinessEventPublisher,
): Promise<BusinessEventOutcome> {
  try {
    const binding = resolve_business_event_interface(interface_ref, "EVENT_PUBLISH");
    resolveRegisteredOperationByExactRef(binding.operation_ref);
    const subjectRef = nonEmptyString(subject_ref, "subject_ref");
    if (runtime_context.stage_contract_ref !== P1_CONTRACT_REF
      || runtime_context.operation_ref !== binding.operation_ref) {
      throw new StableRuntimeError("P1_EVENT_RUNTIME_CONTEXT_OPERATION_MISMATCH", "RuntimeContext must bind the exact P1 owning Operation");
    }
    if (
      owner_execution?.outcome_type !== "response"
      || owner_execution.execution_receipt === undefined
      || !completed_p1_receipts.has(owner_execution.execution_receipt)
      || owner_execution.execution_receipt.outcome_type !== "response"
      || owner_execution.execution_receipt.operation_ref !== binding.operation_ref
      || owner_execution.trace_id !== runtime_context.trace_id
      || owner_execution.request_id !== runtime_context.request_id
      || owner_execution.execution_receipt.trace_id !== runtime_context.trace_id
      || owner_execution.execution_receipt.request_id !== runtime_context.request_id
    ) {
      throw new StableRuntimeError("P1_EVENT_BINDING_INVALID",
        "EVENT_PUBLISH requires a completed, exact, owning P1 Operation outcome and execution receipt");
    }
    // Publication is transport-only, after the owning Operation has completed; it never re-executes the Operation.
    const runtimeResult = await publisher.publish(deep_freeze({
      subject_ref: subjectRef, interface_ref: binding.interface_ref, operation_ref: binding.operation_ref,
      input, runtime_context, trace_id: runtime_context.trace_id, request_id: runtime_context.request_id,
    }));
    const execution_receipt = eventReceipt(binding, subjectRef, owner_execution.execution_receipt);
    return deep_freeze({
      outcome_type: "response" as const,
      subject_ref: subjectRef, runtime_result: runtimeResult, execution_receipt,
      evidence_ref: eventEvidenceRef(execution_receipt),
      trace_id: runtime_context.trace_id, request_id: runtime_context.request_id,
    });
  } catch (error) {
    return deep_freeze({
      outcome_type: "stable_error" as const, subject_ref,
      stable_error: exactEventError(error),
      trace_id: runtime_context.trace_id, request_id: runtime_context.request_id,
    });
  }
}

export async function consume_business_event(
  interface_ref: string,
  subject_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
  hook_binding_set: readonly HookBinding[] = [],
): Promise<BusinessEventOutcome> {
  try {
    const binding = resolve_business_event_interface(interface_ref, "EVENT_CONSUME");
    const subjectRef = nonEmptyString(subject_ref, "subject_ref");
    const registered = resolveRegisteredOperationByExactRef(binding.operation_ref);
    const outcome = await invoke_business_operation({
      route_key: registered.route.operation_ref,
      capability_id: registered.route.capability_id,
      operation_id: registered.route.operation_id,
      trace_id: runtime_context.trace_id,
      request_id: runtime_context.request_id,
    }, input, runtime_context, hook_binding_set);
    if (outcome.outcome_type === "stable_error") {
      return deep_freeze({
        outcome_type: "stable_error" as const, subject_ref: subjectRef,
        stable_error: outcome.stable_error,
        trace_id: outcome.trace_id, request_id: outcome.request_id,
      });
    }
    const execution_receipt = eventReceipt(binding, subjectRef, outcome.execution_receipt);
    return deep_freeze({
      outcome_type: "response" as const, subject_ref: subjectRef,
      runtime_result: outcome.runtime_result,
      execution_receipt, evidence_ref: eventEvidenceRef(execution_receipt),
      trace_id: outcome.trace_id, request_id: outcome.request_id,
    });
  } catch (error) {
    return deep_freeze({
      outcome_type: "stable_error" as const, subject_ref,
      stable_error: exactEventError(error),
      trace_id: runtime_context.trace_id, request_id: runtime_context.request_id,
    });
  }
}

export type BusinessRegistryRegistrationOutcome =
  | Readonly<{ outcome_type: "registration_receipt"; registration_receipt: Readonly<{ object_ref: string }> }>
  | Readonly<{ outcome_type: "stable_error"; stable_error: StableRuntimeErrorShape }>;
export type BusinessRegistryResolutionOutcome =
  | Readonly<{ outcome_type: "exact_resolution"; exact_resolution: BusinessRegistryEntry }>
  | Readonly<{ outcome_type: "stable_error"; stable_error: StableRuntimeErrorShape }>;
export type BusinessRegistryLookupOutcome =
  | Readonly<{ outcome_type: "lookup_result"; lookup_result: BusinessRegistryEntry | null }>
  | Readonly<{ outcome_type: "stable_error"; stable_error: StableRuntimeErrorShape }>;

export function register_business_object(
  object_ref: string,
  object_contract: unknown,
  registry_rule: unknown,
): BusinessRegistryRegistrationOutcome {
  try {
    const objectRef = nonEmptyString(object_ref, "object_ref");
    if (object_contract === undefined || registry_rule === undefined) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "Registry requires both governed static contract and rule");
    }
    const existing = business_objects.get(objectRef);
    if (existing !== undefined) {
      if (existing.object_contract !== object_contract || existing.registry_rule !== registry_rule) {
        throw new StableRuntimeError("P1_BINDING_INVALID", "Business registry object_ref is already bound to different material");
      }
    } else {
      const entry = deep_freeze({ object_ref: objectRef, object_contract, registry_rule } satisfies BusinessRegistryEntry);
      business_objects.set(objectRef, entry);
    }
    return deep_freeze({
      outcome_type: "registration_receipt" as const,
      registration_receipt: deep_freeze({ object_ref: objectRef }),
    });
  } catch (error) {
    return deep_freeze({ outcome_type: "stable_error" as const, stable_error: exactEventError(error) });
  }
}

export function resolve_business_object(resolution_key: string): BusinessRegistryResolutionOutcome {
  try {
    const key = nonEmptyString(resolution_key, "resolution_key");
    const entry = business_objects.get(key);
    if (entry === undefined) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "Exact business registry resolution_key was not registered");
    }
    return deep_freeze({ outcome_type: "exact_resolution" as const, exact_resolution: entry });
  } catch (error) {
    return deep_freeze({ outcome_type: "stable_error" as const, stable_error: exactEventError(error) });
  }
}

export function lookup_business_object(lookup_query: string): BusinessRegistryLookupOutcome {
  try {
    const query = nonEmptyString(lookup_query, "lookup_query");
    const entry = business_objects.get(query);
    return deep_freeze({ outcome_type: "lookup_result" as const, lookup_result: entry ?? null });
  } catch (error) {
    return deep_freeze({ outcome_type: "stable_error" as const, stable_error: exactEventError(error) });
  }
}

export type BusinessHookBindOutcome =
  | Readonly<{
      outcome_type: "binding_receipt";
      binding_validation: "validated";
      binding_receipt: Readonly<{ binding_ref: string; outcome: "validated"; content_hash: string }>;
    }>
  | Readonly<{ outcome_type: "stable_error"; stable_error: StableRuntimeErrorShape }>;

/** P1 exposes only the existing P0 public bind method; no second HookAnchor is created. */
export function bind_business_hook(
  hook_point_value: string,
  consumer_id: string,
  binding: HookBinding,
): BusinessHookBindOutcome {
  try {
    if (hook_point_value !== binding.hook_point_ref || consumer_id !== binding.consumer_ref) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "P1 Hook identity must exactly match its declared P0 HookBinding");
    }
    const result = runtime_provider.bind({ binding });
    return deep_freeze({
      outcome_type: "binding_receipt" as const,
      binding_validation: result.outcome,
      binding_receipt: result,
    });
  } catch (error) {
    return deep_freeze({ outcome_type: "stable_error" as const, stable_error: exactEventError(error) });
  }
}

export type BusinessHookEvaluateOutcome =
  | Readonly<{
      outcome_type: "hook_decision";
      hook_decision: "continue" | "deny" | "recompute";
      hook_evidence: readonly HookEvidence[];
      evidence_ref: string;
    }>
  | Readonly<{ outcome_type: "stable_error"; stable_error: StableRuntimeErrorShape }>;

/**
 * P1 exposes the decision already evaluated by P0's internal HookAnchor.
 * It never invokes P0's runtime-internal evaluate entrypoint directly.
 */
export function evaluate_business_hook(
  hook_point_value: "before_process" | "after_process" | "on_error",
  consumer_id: string,
  trace_id: string,
  request_id: string,
  execution_receipt: P1ExecutionReceipt,
): BusinessHookEvaluateOutcome {
  try {
    if (!completed_p1_receipts.has(execution_receipt)
      || execution_receipt.trace_id !== trace_id
      || execution_receipt.request_id !== request_id) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "P1 Hook evaluation requires exact P0-produced execution evidence");
    }
    const evidence = execution_receipt.hook_evidence.filter(
      (item) => item.hook_point_ref === hook_point_value && item.consumer_ref === consumer_id,
    );
    const exactDecision = evidence[0];
    if (evidence.length !== 1 || exactDecision?.decision === undefined || exactDecision.error !== undefined) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "P1 Hook evaluation must resolve one exact P0 decision");
    }
    const hook_evidence = deep_freeze(evidence);
    return deep_freeze({
      outcome_type: "hook_decision" as const,
      hook_decision: exactDecision.decision,
      hook_evidence,
      evidence_ref: `sha256:${createHash("sha256").update(canonicalEvidenceJson(hook_evidence), "utf8").digest("hex")}`,
    });
  } catch (error) {
    return deep_freeze({ outcome_type: "stable_error" as const, stable_error: exactEventError(error) });
  }
}

/**
 * V0186 dependency_invoke is a P1-internal framework path, not a concrete
 * Capability CALL_INVOKE anchor. The existing declared dependency client owns
 * provider Q Interface semantics; this registry neither translates them nor
 * creates another Runtime or a second protocol.
 */
export interface P1DependencyClientRequest {
  readonly input: unknown;
  readonly context: unknown;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P1DependencyClientBinding {
  readonly local_dependency_id: string;
  readonly dependency_contract_ref: string;
  readonly dependency_client_ref: string;
  readonly dependency_binding_ref: string;
  readonly invoke: (request: Readonly<P1DependencyClientRequest>) =>
    BusinessOperationOutcome | Promise<BusinessOperationOutcome>;
}

const p1_dependency_clients = new Map<string, P1DependencyClientBinding>();

export function register_business_dependency_client(binding: P1DependencyClientBinding): void {
  const id = nonEmptyString(binding.local_dependency_id, "local_dependency_id");
  for (const [field, ref] of [
    ["dependency_contract_ref", binding.dependency_contract_ref],
    ["dependency_client_ref", binding.dependency_client_ref],
    ["dependency_binding_ref", binding.dependency_binding_ref],
  ] as const) {
    if (!exact_ref(ref)) throw new StableRuntimeError("P1_BINDING_INVALID", `${field} must be one exact declared ref`);
  }
  if (typeof binding.invoke !== "function") {
    throw new StableRuntimeError("P1_BINDING_INVALID", "the exact dependency client must expose its existing invoke implementation");
  }
  if (p1_dependency_clients.has(id)) {
    throw new StableRuntimeError("P1_BINDING_INVALID", "duplicate declared local_dependency_id is forbidden");
  }
  p1_dependency_clients.set(id, deep_freeze({ ...binding }));
}

export async function invoke_dependency(
  local_dependency_id: string,
  input: unknown,
  context: unknown,
  trace_id: string,
  request_id: string,
): Promise<BusinessOperationOutcome> {
  try {
    const id = nonEmptyString(local_dependency_id, "local_dependency_id");
    const traceId = nonEmptyString(trace_id, "trace_id");
    const requestId = nonEmptyString(request_id, "request_id");
    const binding = p1_dependency_clients.get(id);
    if (binding === undefined) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "local_dependency_id has no exact registered P1 dependency client");
    }
    // Preserve the owning client's exact Q Interface response/error envelope.
    const outcome = await binding.invoke({ input, context, trace_id: traceId, request_id: requestId });
    if (
      (outcome?.outcome_type !== "response" && outcome?.outcome_type !== "stable_error")
      || outcome.trace_id !== traceId || outcome.request_id !== requestId
      || (outcome.outcome_type === "response" && !("runtime_result" in outcome))
      || (outcome.outcome_type === "stable_error" && !("stable_error" in outcome))
    ) {
      throw new StableRuntimeError("P1_BINDING_INVALID", "dependency client returned an invalid Q outcome or correlation");
    }
    return outcome;
  } catch (error) {
    const stable_error = exactEventError(error);
    return deep_freeze({
      outcome_type: "stable_error" as const, stable_error, trace_id, request_id,
    });
  }
}
