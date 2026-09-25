import assert from "node:assert/strict";
import test from "node:test";
import {
  P0_BIND_INTERFACE_REF,
  P0_EVALUATE_INTERFACE_REF,
} from "../../../src/p0/runtime_contract.ts";
import type {
  HookBinding,
  RuntimeContext,
} from "../../../src/p0/runtime_contract.ts";
import {
  bind_business_hook,
  consume_business_event,
  invoke_business_operation,
  publish_business_event,
  register_business_event_interface,
  register_business_operation,
  registered_business_event_interface_refs,
  registered_business_operation_refs,
  resolve_business_event_interface,
  resolve_business_operation,
} from "../../../src/p1/business_runtime/business_operation_registry.ts";
import type { BusinessEventInterfaceBinding } from "../../../src/p1/business_runtime/business_operation_registry.ts";

const P1_REF = "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0182";
const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const CAPABILITY_ID = "example";
const CALL_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_invoke`;
const OPERATION_REF = `${CAPABILITY_REF}#/operations/example`;

function contextFor(operation_ref: string): RuntimeContext {
  return Object.freeze({
    stage_contract_ref: P1_REF,
    operation_ref,
    trace_id: "trace:test",
    request_id: "request:test",
    invocation_id: "invocation:test",
    binding_set_ref: "binding:test",
    attributes: Object.freeze({ injected: "yes" }),
  });
}

function registerOperation(
  args: Readonly<{
    route_key: string;
    capability_id?: string;
    operation_id: string;
    capability_ref?: string;
    operation_ref: string;
    interface_ref?: string;
    hook_binding_refs?: readonly string[];
    hook_consumer_refs?: readonly string[];
    handler: (input: unknown, context: RuntimeContext) => unknown | Promise<unknown>;
  }>,
): void {
  register_business_operation({
    route_key: args.route_key,
    capability_id: args.capability_id ?? CAPABILITY_ID,
    operation_id: args.operation_id,
    capability_contract_ref: args.capability_ref ?? CAPABILITY_REF,
    operation_ref: args.operation_ref,
    provided_interface_refs: [args.interface_ref ?? CALL_INTERFACE_REF],
    hook_binding_refs: args.hook_binding_refs ?? [],
    hook_consumer_refs: args.hook_consumer_refs ?? [],
    handler: args.handler,
  });
}

test("P1 CALL resolves exact route and executes the Operation only through P0", async () => {
  const handler = async (input: unknown, context: RuntimeContext) => ({
    input,
    stage_contract_ref: context.stage_contract_ref,
    operation_ref: context.operation_ref,
    trace_id: context.trace_id,
    request_id: context.request_id,
    invocation_id: context.invocation_id,
    binding_set_ref: context.binding_set_ref,
    injected: context.attributes?.injected,
  });

  registerOperation({
    route_key: "route:example",
    operation_id: "example",
    operation_ref: OPERATION_REF,
    handler,
  });

  assert.equal(resolve_business_operation(OPERATION_REF), handler);
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));

  const result = await invoke_business_operation({
    route_key: "route:example",
    capability_id: CAPABILITY_ID,
    operation_id: "example",
    input: { value: 1 },
    runtime_context: contextFor(`${CAPABILITY_REF}#/operations/caller_selected_must_not_win`),
    trace_id: "trace:call",
    request_id: "request:call",
  });

  assert.equal(result.outcome_type, "response");
  if (result.outcome_type !== "response") return;
  assert.equal(result.runtime_result.outcome, "success");
  if (result.runtime_result.outcome !== "success") return;

  assert.equal(result.runtime_result.operation_attempts, 1);
  assert.deepEqual(result.runtime_result.value, {
    input: { value: 1 },
    stage_contract_ref: P1_REF,
    operation_ref: OPERATION_REF,
    trace_id: "trace:call",
    request_id: "request:call",
    invocation_id: "invocation:test",
    binding_set_ref: "binding:test",
    injected: "yes",
  });
});

test("P1 CALL rejects an unresolved exact Route before any Operation attempt", async () => {
  const ref = `${CAPABILITY_REF}#/operations/route_reject`;
  let attempts = 0;
  registerOperation({
    route_key: "route:registered",
    operation_id: "route_reject",
    operation_ref: ref,
    handler: async () => {
      attempts += 1;
      return "must-not-run";
    },
  });

  await assert.rejects(
    () => invoke_business_operation({
      route_key: "route:not-registered",
      capability_id: CAPABILITY_ID,
      operation_id: "route_reject",
      input: {},
      runtime_context: contextFor(ref),
      trace_id: "trace:reject",
      request_id: "request:reject",
    }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_OPERATION_NOT_REGISTERED",
  );
  assert.equal(attempts, 0);
});

test("P1 CALL lets P0 fail closed on incomplete P0-owned RuntimeContext", async () => {
  const ref = `${CAPABILITY_REF}#/operations/context_validation`;
  let attempts = 0;
  registerOperation({
    route_key: "route:context",
    operation_id: "context_validation",
    operation_ref: ref,
    handler: async () => {
      attempts += 1;
      return "must-not-run";
    },
  });

  const incomplete = Object.freeze({
    stage_contract_ref: P1_REF,
    operation_ref: ref,
    trace_id: "trace:context",
    request_id: "request:context",
    binding_set_ref: "binding:context",
  }) as unknown as RuntimeContext;

  const result = await invoke_business_operation({
    route_key: "route:context",
    capability_id: CAPABILITY_ID,
    operation_id: "context_validation",
    input: {},
    runtime_context: incomplete,
    trace_id: "trace:context",
    request_id: "request:context",
  });

  assert.equal(result.outcome_type, "stable_error");
  if (result.outcome_type !== "stable_error") return;
  assert.equal(result.stable_error.code, "P0_CONTEXT_INVALID");
  assert.equal(attempts, 0);
});

test("P1 HOOK_BIND persists validated binding outside P0 and before_process deny keeps attempts at zero", async () => {
  const ref = `${CAPABILITY_REF}#/operations/hook_denied`;
  const bindingRef = "Q.TEST.BINDING.AUTHORIZATION@V0100";
  const consumerRef = "Q.TEST.HOOK.AUTHORIZATION@V0100";
  let attempts = 0;

  const binding: HookBinding = Object.freeze({
    binding_ref: bindingRef,
    canonical_name: "authorization",
    hook_point_ref: "before_process",
    consumer_ref: consumerRef,
    consumer_contract_ref: "Q.TEST.CONTRACT.HOOK.AUTHORIZATION@V0100",
    provider_bind_interface_ref: P0_BIND_INTERFACE_REF,
    provider_evaluate_interface_ref: P0_EVALUATE_INTERFACE_REF,
    allowed_decision_subset: Object.freeze(["deny"] as const),
    order: 0,
    enabled_rule_ref: "Q.TEST.RULE.AUTHORIZATION_ENABLED@V0100",
    enabled: true,
    status: "active",
    rule_version_ref: "Q.TEST.RULE.AUTHORIZATION@V0100",
    consumer: Object.freeze({
      consumer_ref: consumerRef,
      evaluate() {
        return Object.freeze({ decision: "deny" as const });
      },
    }),
  });

  const receipt = bind_business_hook(binding);
  assert.equal(receipt.binding_ref, bindingRef);
  assert.equal(receipt.outcome, "validated");

  registerOperation({
    route_key: "route:hook-denied",
    operation_id: "hook_denied",
    operation_ref: ref,
    hook_binding_refs: [bindingRef],
    hook_consumer_refs: [consumerRef],
    handler: async () => {
      attempts += 1;
      return "must-not-run";
    },
  });

  const result = await invoke_business_operation({
    route_key: "route:hook-denied",
    capability_id: CAPABILITY_ID,
    operation_id: "hook_denied",
    input: {},
    runtime_context: Object.freeze({
      ...contextFor(ref),
      binding_set_ref: "binding-set:authorization",
    }),
    trace_id: "trace:hook",
    request_id: "request:hook",
  });

  assert.equal(result.outcome_type, "response");
  if (result.outcome_type !== "response") return;
  assert.equal(result.runtime_result.outcome, "denied");
  assert.equal(result.runtime_result.operation_attempts, 0);
  assert.equal(attempts, 0);
});

test("P1 CALL supplies only registered exact Hook bindings and lets P0 reject an incomplete set", async () => {
  const ref = `${CAPABILITY_REF}#/operations/missing_hook_binding`;
  const missingBindingRef = "Q.TEST.BINDING.MISSING@V0100";
  let attempts = 0;

  registerOperation({
    route_key: "route:missing-hook",
    operation_id: "missing_hook_binding",
    operation_ref: ref,
    hook_binding_refs: [missingBindingRef],
    handler: async () => {
      attempts += 1;
      return "must-not-run";
    },
  });

  const result = await invoke_business_operation({
    route_key: "route:missing-hook",
    capability_id: CAPABILITY_ID,
    operation_id: "missing_hook_binding",
    input: {},
    runtime_context: contextFor(ref),
    trace_id: "trace:missing-hook",
    request_id: "request:missing-hook",
  });

  assert.equal(result.outcome_type, "stable_error");
  if (result.outcome_type !== "stable_error") return;
  assert.equal(result.stable_error.code, "P0_BINDING_SET_MISMATCH");
  assert.equal(attempts, 0);
});

test("P1 business operation registration fails closed on a conflicting exact Route", () => {
  const firstRef = `${CAPABILITY_REF}#/operations/route_collision_first`;
  const secondRef = `${CAPABILITY_REF}#/operations/route_collision_second`;
  const handler = async () => "ok";

  registerOperation({
    route_key: "route:collision",
    operation_id: "route_collision",
    operation_ref: firstRef,
    handler,
  });

  assert.throws(
    () => registerOperation({
      route_key: "route:collision",
      operation_id: "route_collision",
      operation_ref: secondRef,
      handler,
    }),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_OPERATION_DUPLICATE",
  );
});

test("P1 EVENT_CONSUME resolves the exact Interface binding and executes the existing Operation through P0", async () => {
  const operationRef = `${CAPABILITY_REF}#/operations/example_event_consume`;
  const interfaceRef = `${CAPABILITY_REF}#/interfaces/example_event_consume`;

  registerOperation({
    route_key: "route:event-consume",
    operation_id: "example_event_consume",
    operation_ref: operationRef,
    interface_ref: interfaceRef,
    handler: async (input, runtimeContext) => ({
      consumed: input,
      operation_ref: runtimeContext.operation_ref,
      stage_contract_ref: runtimeContext.stage_contract_ref,
      invocation_id: runtimeContext.invocation_id,
    }),
  });

  const binding = register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT",
    kind: "EVENT_CONSUME",
    method_ref: "consume_business_event",
  });

  assert.equal(resolve_business_event_interface(interfaceRef), binding);
  assert.ok(registered_business_event_interface_refs().includes(interfaceRef));

  const eventInput = Object.freeze({ id: 7, payload: Object.freeze({ exact: true }) });
  assert.deepEqual(
    await consume_business_event(
      interfaceRef,
      eventInput,
      contextFor(`${CAPABILITY_REF}#/operations/transport_selected_should_be_ignored`),
    ),
    {
      consumed: eventInput,
      operation_ref: operationRef,
      stage_contract_ref: P1_REF,
      invocation_id: "invocation:test",
    },
  );

  await assert.rejects(
    () => consume_business_event(
      operationRef,
      eventInput,
      contextFor(operationRef),
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_NOT_REGISTERED",
  );
});

test("P1 EVENT binding rejects legacy adapter or undeclared binding fields", () => {
  const consumeOperationRef = `${CAPABILITY_REF}#/operations/legacy_consume_target`;
  const legacy = {
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: `${CAPABILITY_REF}#/interfaces/legacy_consume`,
    operation_ref: consumeOperationRef,
    surface: "EVENT",
    kind: "EVENT_CONSUME",
    method_ref: "consume_business_event",
    consume_adapter: () => undefined,
  } as unknown as BusinessEventInterfaceBinding;

  assert.throws(
    () => register_business_event_interface(legacy),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_BINDING_INVALID",
  );
});

test("P1 EVENT publish uses exact binding after owner fact and never re-executes the owning Operation", async () => {
  const operationRef = `${CAPABILITY_REF}#/operations/example_event_publish`;
  const interfaceRef = `${CAPABILITY_REF}#/interfaces/example_event_publish`;
  let operationAttempts = 0;
  let published: unknown;

  registerOperation({
    route_key: "route:event-publish",
    operation_id: "example_event_publish",
    operation_ref: operationRef,
    interface_ref: interfaceRef,
    handler: async () => {
      operationAttempts += 1;
      return "must-not-run";
    },
  });

  register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT",
    kind: "EVENT_PUBLISH",
    method_ref: "publish_business_event",
  });

  const context = contextFor(operationRef);
  assert.deepEqual(
    await publish_business_event(
      interfaceRef,
      { authoritative_fact: "ready" },
      context,
      Object.freeze({
        publish(request: unknown) {
          published = request;
          return { published: true };
        },
      }),
    ),
    { published: true },
  );
  assert.equal(operationAttempts, 0);
  assert.deepEqual(published, {
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    input: { authoritative_fact: "ready" },
    runtime_context: context,
  });

  await assert.rejects(
    () => consume_business_event(interfaceRef, {}, context),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_KIND_MISMATCH",
  );

  const wrongContext = Object.freeze({
    ...context,
    operation_ref: `${CAPABILITY_REF}#/operations/other`,
  });
  await assert.rejects(
    () => publish_business_event(
      interfaceRef,
      {},
      wrongContext,
      Object.freeze({ publish: async () => ({ published: true }) }),
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_RUNTIME_CONTEXT_OPERATION_MISMATCH",
  );
});
