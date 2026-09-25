import { runtime_provider } from "#q/p0/stage_handler.ts";
import {
  StableRuntimeError,
  deep_freeze,
  exact_ref,
} from "../../p0/runtime_contract.ts";
import type {
  HookBindResult,
  HookBinding,
  RuntimeContext,
  RuntimeInvokeResult,
  RuntimeOperation,
  StableRuntimeErrorShape,
  StageExtensionContract,
} from "../../p0/runtime_contract.ts";
import {
  P1_CONTRACT_REF,
  create_p1_capability_stage_extension,
} from "./stage_extension_contract.ts";

export type BusinessOperationHandler = RuntimeOperation<unknown, unknown>;
export type BusinessEventInterfaceKind = "EVENT_PUBLISH" | "EVENT_CONSUME";

export interface BusinessOperationRouteIdentity {
  readonly route_key: string;
  readonly capability_id: string;
  readonly operation_id: string;
}

export interface BusinessOperationRegistration extends BusinessOperationRouteIdentity {
  readonly capability_contract_ref: string;
  readonly operation_ref: string;
  readonly provided_interface_refs: readonly string[];
  readonly hook_consumer_refs?: readonly string[];
  readonly hook_binding_refs?: readonly string[];
  readonly port_refs?: readonly string[];
  readonly handler: BusinessOperationHandler;
}

interface RegisteredBusinessOperation {
  readonly capability_contract_ref: string;
  readonly operation_ref: string;
  readonly stage_extension: StageExtensionContract;
  readonly handler: BusinessOperationHandler;
}

export interface BusinessOperationInvokeRequest extends BusinessOperationRouteIdentity {
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface BusinessOperationInvokeResponse {
  readonly outcome_type: "response";
  readonly runtime_result: RuntimeInvokeResult<unknown>;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface BusinessOperationInvokeStableError {
  readonly outcome_type: "stable_error";
  readonly stable_error: StableRuntimeErrorShape;
  readonly trace_id: string;
  readonly request_id: string;
}

export type BusinessOperationInvokeOutcome =
  | BusinessOperationInvokeResponse
  | BusinessOperationInvokeStableError;

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
  /** P1 framework EVENT method identity declared by the exact Capability Interface. */
  readonly method_ref: "publish_business_event" | "consume_business_event";
}

export interface BusinessEventPublishRequest {
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
}

export interface BusinessEventPublisher {
  publish(request: Readonly<BusinessEventPublishRequest>): unknown | Promise<unknown>;
}

const operations = new Map<string, RegisteredBusinessOperation>();
const operation_routes = new Map<
  string,
  Map<string, Map<string, RegisteredBusinessOperation>>
>();
const business_objects = new Map<string, BusinessRegistryEntry>();
const event_interfaces = new Map<string, BusinessEventInterfaceBinding>();
const business_hook_bindings = new Map<string, HookBinding>();
const business_hook_binding_receipts = new Map<string, HookBindResult>();

function nonEmptyString(value: string, field: string): string {
  if (value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function exactCapabilityMember(
  capabilityContractRef: string,
  memberRef: string,
  memberKind: "operations" | "interfaces",
  field: string,
): string {
  if (!exact_ref(capabilityContractRef) || capabilityContractRef.includes("#/")) {
    throw new Error(
      "capability_contract_ref must be an exact versioned Capability Contract ref",
    );
  }
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/${memberKind}/`)) {
    throw new Error(`${field} must be an exact member of capability_contract_ref`);
  }
  return exact;
}

function sameRefs(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function sameRegisteredOperation(
  left: RegisteredBusinessOperation,
  right: RegisteredBusinessOperation,
): boolean {
  return left.capability_contract_ref === right.capability_contract_ref
    && left.operation_ref === right.operation_ref
    && left.handler === right.handler
    && left.stage_extension.implementation_ref === right.stage_extension.implementation_ref
    && sameRefs(left.stage_extension.provided_interface_refs, right.stage_extension.provided_interface_refs)
    && sameRefs(left.stage_extension.hook_consumer_refs, right.stage_extension.hook_consumer_refs)
    && sameRefs(left.stage_extension.hook_binding_refs, right.stage_extension.hook_binding_refs)
    && sameRefs(left.stage_extension.port_refs, right.stage_extension.port_refs);
}

function routeBucket(
  route_key: string,
  capability_id: string,
  create: boolean,
): Map<string, RegisteredBusinessOperation> | undefined {
  let capabilities = operation_routes.get(route_key);
  if (capabilities === undefined && create) {
    capabilities = new Map<string, Map<string, RegisteredBusinessOperation>>();
    operation_routes.set(route_key, capabilities);
  }
  if (capabilities === undefined) return undefined;

  let operationsForCapability = capabilities.get(capability_id);
  if (operationsForCapability === undefined && create) {
    operationsForCapability = new Map<string, RegisteredBusinessOperation>();
    capabilities.set(capability_id, operationsForCapability);
  }
  return operationsForCapability;
}

/**
 * Registers the governed static P1 Capability/Operation overlay needed by the
 * fixed business_operation_invoke path.
 *
 * route_key, capability_id and operation_id are opaque exact PATH identities.
 * This fixed Skeleton deliberately does not derive or encode them.
 */
export function register_business_operation(
  registration: Readonly<BusinessOperationRegistration>,
): void {
  const routeKey = nonEmptyString(registration.route_key, "route_key");
  const capabilityId = nonEmptyString(registration.capability_id, "capability_id");
  const operationId = nonEmptyString(registration.operation_id, "operation_id");
  const capabilityContractRef = nonEmptyString(
    registration.capability_contract_ref,
    "capability_contract_ref",
  );
  const operationRef = exactCapabilityMember(
    capabilityContractRef,
    registration.operation_ref,
    "operations",
    "operation_ref",
  );

  const stageExtension = create_p1_capability_stage_extension({
    implementation_ref: capabilityContractRef,
    provided_interface_refs: [...registration.provided_interface_refs],
    hook_consumer_refs: [...(registration.hook_consumer_refs ?? [])],
    hook_binding_refs: [...(registration.hook_binding_refs ?? [])],
    port_refs: [...(registration.port_refs ?? [])],
  });

  const candidate = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    operation_ref: operationRef,
    stage_extension: stageExtension,
    handler: registration.handler,
  } satisfies RegisteredBusinessOperation);

  const existingOperation = operations.get(operationRef);
  const exactOperation = existingOperation ?? candidate;
  if (existingOperation !== undefined && !sameRegisteredOperation(existingOperation, candidate)) {
    throw new StableRuntimeError(
      "P1_OPERATION_DUPLICATE",
      "Operation ref already has different governed runtime material",
    );
  }
  if (existingOperation === undefined) operations.set(operationRef, candidate);

  const bucket = routeBucket(routeKey, capabilityId, true)!;
  const existingRoute = bucket.get(operationId);
  if (existingRoute !== undefined && existingRoute.operation_ref !== exactOperation.operation_ref) {
    throw new StableRuntimeError(
      "P1_OPERATION_DUPLICATE",
      "Exact P1 Route identity already resolves a different Operation",
    );
  }
  bucket.set(operationId, exactOperation);
}

/** Exact Operation-ref resolver used only after a governed binding already selected the Operation. */
export function resolve_business_operation(operation_ref: string): BusinessOperationHandler {
  const registration = operations.get(operation_ref);
  if (registration === undefined) {
    throw new StableRuntimeError("P1_OPERATION_NOT_REGISTERED", "Operation ref is not registered");
  }
  return registration.handler;
}

function resolveBusinessOperationRoute(
  route: Readonly<BusinessOperationRouteIdentity>,
): RegisteredBusinessOperation {
  const registration = routeBucket(route.route_key, route.capability_id, false)
    ?.get(route.operation_id);
  if (registration === undefined) {
    throw new StableRuntimeError(
      "P1_OPERATION_NOT_REGISTERED",
      "Exact route_key, capability_id and operation_id identity is not registered",
    );
  }
  return registration;
}

function resolveRegisteredOperationByRef(operation_ref: string): RegisteredBusinessOperation {
  const registration = operations.get(operation_ref);
  if (registration === undefined) {
    throw new StableRuntimeError("P1_OPERATION_NOT_REGISTERED", "Operation ref is not registered");
  }
  return registration;
}

/**
 * P1 HOOK_BIND realization.
 *
 * P0 validates but stores no concrete binding. P1 retains the validated exact
 * binding material outside P0 so a later invocation can supply the exact
 * StageExtension hook_binding_refs snapshot to runtime_provider.invoke.
 */
export function bind_business_hook(binding: HookBinding): HookBindResult {
  const receipt = runtime_provider.bind({ binding });
  const existingReceipt = business_hook_binding_receipts.get(binding.binding_ref);
  if (
    existingReceipt !== undefined
    && existingReceipt.content_hash !== receipt.content_hash
  ) {
    throw new Error("Hook binding ref already has different exact binding material");
  }

  if (existingReceipt === undefined) {
    business_hook_bindings.set(
      binding.binding_ref,
      deep_freeze({
        ...binding,
        allowed_decision_subset: [...binding.allowed_decision_subset],
        consumer: { ...binding.consumer },
      }),
    );
    business_hook_binding_receipts.set(binding.binding_ref, receipt);
  }
  return existingReceipt ?? receipt;
}

function hookBindingSet(
  registration: RegisteredBusinessOperation,
): readonly HookBinding[] {
  const bindings = registration.stage_extension.hook_binding_refs
    .map((ref) => business_hook_bindings.get(ref))
    .filter((binding): binding is HookBinding => binding !== undefined);
  return deep_freeze(bindings);
}

function bindRuntimeContext(
  runtime_context: RuntimeContext,
  operation_ref: string,
  trace_id: string,
  request_id: string,
): RuntimeContext {
  return deep_freeze({
    ...runtime_context,
    stage_contract_ref: P1_CONTRACT_REF,
    operation_ref,
    trace_id,
    request_id,
  });
}

async function invokeRegisteredBusinessOperation(
  registration: RegisteredBusinessOperation,
  input: unknown,
  runtime_context: RuntimeContext,
): Promise<RuntimeInvokeResult<unknown>> {
  return await runtime_provider.invoke({
    stage_extension: registration.stage_extension,
    runtime_context,
    input,
    operation: registration.handler,
    hook_binding_set: hookBindingSet(registration),
  });
}

/**
 * P1 business_operation_invoke realization.
 *
 * The exact Route is resolved before P0 invocation. The fixed Skeleton then
 * projects the Capability overlay into StageExtensionContract and delegates the
 * one concrete Operation attempt to the sole P0 runtime_provider.
 */
export async function invoke_business_operation(
  request: Readonly<BusinessOperationInvokeRequest>,
): Promise<BusinessOperationInvokeOutcome> {
  const registration = resolveBusinessOperationRoute(request);
  const runtimeContext = bindRuntimeContext(
    request.runtime_context,
    registration.operation_ref,
    request.trace_id,
    request.request_id,
  );
  const runtimeResult = await invokeRegisteredBusinessOperation(
    registration,
    request.input,
    runtimeContext,
  );

  if (runtimeResult.outcome === "error") {
    return deep_freeze({
      outcome_type: "stable_error",
      stable_error: runtimeResult.error,
      trace_id: request.trace_id,
      request_id: request.request_id,
    });
  }

  return deep_freeze({
    outcome_type: "response",
    runtime_result: runtimeResult,
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
}

export function registered_business_operation_refs(): readonly string[] {
  return deep_freeze([...operations.keys()].sort());
}

/**
 * Registers one exact concrete Capability EVENT Interface-to-Operation binding.
 *
 * The concrete Capability Contract remains semantic authority. Runtime transport,
 * caller input, channel identity, and source-code discovery are never allowed to
 * select or override the bound Operation.
 */
export function register_business_event_interface(
  binding: Readonly<BusinessEventInterfaceBinding>,
): BusinessEventInterfaceBinding {
  const allowedBindingKeys = new Set([
    "capability_contract_ref",
    "interface_ref",
    "operation_ref",
    "surface",
    "kind",
    "method_ref",
  ]);
  const unknownBindingKeys = Object.keys(binding).filter((key) => !allowedBindingKeys.has(key));
  if (unknownBindingKeys.length > 0) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "EVENT binding contains undeclared fields",
      { unknown_binding_keys: unknownBindingKeys.sort() },
    );
  }
  const capabilityContractRef = nonEmptyString(
    binding.capability_contract_ref,
    "capability_contract_ref",
  );
  const interfaceRef = exactCapabilityMember(
    capabilityContractRef,
    binding.interface_ref,
    "interfaces",
    "interface_ref",
  );
  const operationRef = exactCapabilityMember(
    capabilityContractRef,
    binding.operation_ref,
    "operations",
    "operation_ref",
  );
  if (binding.surface !== "EVENT") {
    throw new StableRuntimeError("P1_EVENT_BINDING_INVALID", "EVENT binding surface must equal EVENT");
  }
  const methodRef = nonEmptyString(binding.method_ref, "method_ref");
  if (binding.kind !== "EVENT_PUBLISH" && binding.kind !== "EVENT_CONSUME") {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "EVENT binding kind must be EVENT_PUBLISH or EVENT_CONSUME",
    );
  }
  const expectedMethodRef =
    binding.kind === "EVENT_PUBLISH" ? "publish_business_event" : "consume_business_event";
  if (methodRef !== expectedMethodRef) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      `EVENT ${binding.kind} method_ref must equal ${expectedMethodRef}`,
    );
  }

  const exactBinding = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT",
    kind: binding.kind,
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

/**
 * P1 EVENT_PUBLISH realization.
 *
 * The exact EVENT_PUBLISH Interface is preverified against its owning Operation.
 * Publication occurs only after that Operation has produced its authoritative
 * fact/finalized outcome. This method therefore does not execute the Operation;
 * it delegates delivery to an injected non-semantic transport publisher.
 */
export async function publish_business_event(
  interface_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
  publisher: BusinessEventPublisher,
): Promise<unknown> {
  const binding = resolve_business_event_interface(interface_ref, "EVENT_PUBLISH");
  if (runtime_context.operation_ref !== binding.operation_ref) {
    throw new StableRuntimeError(
      "P1_EVENT_RUNTIME_CONTEXT_OPERATION_MISMATCH",
      "RuntimeContext operation_ref must equal the exact Operation bound by the EVENT_PUBLISH Interface",
    );
  }
  return await publisher.publish(deep_freeze({
    interface_ref: binding.interface_ref,
    operation_ref: binding.operation_ref,
    input,
    runtime_context,
  } satisfies BusinessEventPublishRequest));
}

/**
 * P1 EVENT_CONSUME realization.
 *
 * Transport supplies the exact Interface identity plus opaque event input/context.
 * The Operation identity is derived only from the preverified Interface binding;
 * transport/caller Operation selection is ignored rather than treated as authority.
 * The existing Operation executes through the same P0 runtime path as CALL.
 */
export async function consume_business_event(
  interface_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
): Promise<unknown> {
  const binding = resolve_business_event_interface(interface_ref, "EVENT_CONSUME");
  const registration = resolveRegisteredOperationByRef(binding.operation_ref);
  const boundRuntimeContext = bindRuntimeContext(
    runtime_context,
    registration.operation_ref,
    runtime_context.trace_id,
    runtime_context.request_id,
  );
  const runtimeResult = await invokeRegisteredBusinessOperation(
    registration,
    input,
    boundRuntimeContext,
  );

  return runtimeResult.outcome === "success"
    ? runtimeResult.value
    : runtimeResult;
}

/**
 * P1 REGISTRY_REGISTER realization.
 *
 * The registry stores only the exact static object_contract + registry_rule supplied by
 * the governed Capability projection. It does not infer public interfaces, expand a
 * provider surface, execute a business Operation, or derive any unresolved hash.
 */
export function register_business_object(
  object_ref: string,
  object_contract: unknown,
  registry_rule: unknown,
): BusinessRegistryEntry {
  const existing = business_objects.get(object_ref);
  if (existing !== undefined) {
    if (existing.object_contract !== object_contract || existing.registry_rule !== registry_rule) {
      throw new Error("Business registry object ref already has different static registry material");
    }
    return existing;
  }

  const entry = deep_freeze({
    object_ref,
    object_contract,
    registry_rule,
  } satisfies BusinessRegistryEntry);

  business_objects.set(object_ref, entry);
  return entry;
}

/** P1 REGISTRY_RESOLVE realization using the exact registered object_ref as resolution key. */
export function resolve_business_object(resolution_key: string): BusinessRegistryEntry {
  const entry = business_objects.get(resolution_key);
  if (entry === undefined) {
    throw new Error("Business registry resolution key is not registered");
  }
  return entry;
}

/** P1 REGISTRY_LOOKUP realization; lookup is read-only and never invokes business Operations. */
export function lookup_business_object(lookup_query: string): BusinessRegistryEntry | undefined {
  return business_objects.get(lookup_query);
}
