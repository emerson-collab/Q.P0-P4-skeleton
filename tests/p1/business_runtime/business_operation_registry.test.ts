import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeContext } from "../../../src/p0/runtime_contract.ts";
import {
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

const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OPERATION_REF = `${CAPABILITY_REF}#/operations/example`;
const CONSUME_OPERATION_REF = `${CAPABILITY_REF}#/operations/example_event_consume`;
const PUBLISH_OPERATION_REF = `${CAPABILITY_REF}#/operations/example_event_publish`;
const CONSUME_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_consume`;
const PUBLISH_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_publish`;

function contextFor(operation_ref: string): RuntimeContext {
  return Object.freeze({
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
    operation_ref,
    trace_id: "trace:test",
    request_id: "request:test",
    invocation_id: "invocation:test",
    binding_set_ref: "binding:test",
    attributes: Object.freeze({ injected: "yes" }),
  });
}

test("P1 business operation registry preserves RuntimeContext during invocation", async () => {
  const handler = async (input: unknown, context: RuntimeContext) => ({
    input,
    operation_ref: context.operation_ref,
    binding_set_ref: context.binding_set_ref,
    injected: context.attributes?.injected,
  });

  register_business_operation(OPERATION_REF, handler);
  const context = contextFor(OPERATION_REF);

  assert.equal(resolve_business_operation(OPERATION_REF), handler);
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));
  assert.deepEqual(
    await invoke_business_operation(OPERATION_REF, { value: 1 }, context),
    {
      input: { value: 1 },
      operation_ref: OPERATION_REF,
      binding_set_ref: "binding:test",
      injected: "yes",
    },
  );
});

test("P1 business operation registry fails closed on duplicate different handler", () => {
  const ref = `${CAPABILITY_REF}#/operations/duplicate`;
  register_business_operation(ref, async () => "first");
  assert.throws(
    () => register_business_operation(ref, async () => "second"),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_OPERATION_DUPLICATE",
  );
});

test("P1 EVENT_CONSUME dispatches through concrete Interface adapter to the exact existing Operation", async () => {
  register_business_operation(
    CONSUME_OPERATION_REF,
    async (input, runtimeContext) => ({
      consumed: input,
      operation_ref: runtimeContext.operation_ref,
    }),
  );
  const binding = register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: CONSUME_INTERFACE_REF,
    operation_ref: CONSUME_OPERATION_REF,
    surface: "EVENT",
    kind: "EVENT_CONSUME",
    method_ref: "consume_standard_registration",
    consume_adapter: async (input, runtimeContext, invokeBoundOperation) => {
      const event = input as { id: number };
      return await invokeBoundOperation(
        { subject_source_binding: { source_ref: `event:${event.id}` } },
        runtimeContext,
      );
    },
  });

  assert.equal(resolve_business_event_interface(CONSUME_INTERFACE_REF), binding);
  assert.ok(registered_business_event_interface_refs().includes(CONSUME_INTERFACE_REF));
  assert.deepEqual(
    await consume_business_event(
      CONSUME_INTERFACE_REF,
      { id: 7 },
      contextFor(`${CAPABILITY_REF}#/operations/transport_selected_should_be_ignored`),
    ),
    {
      consumed: { subject_source_binding: { source_ref: "event:7" } },
      operation_ref: CONSUME_OPERATION_REF,
    },
  );
  await assert.rejects(
    () => consume_business_event(
      CONSUME_OPERATION_REF,
      { id: 7 },
      contextFor(CONSUME_OPERATION_REF),
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_NOT_REGISTERED",
  );
});

test("P1 EVENT publish uses exact binding after owner fact and never re-executes the owning Operation", async () => {
  let operationAttempts = 0;
  let published: unknown;
  register_business_operation(PUBLISH_OPERATION_REF, async () => {
    operationAttempts += 1;
    return "must-not-run";
  });
  register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: PUBLISH_INTERFACE_REF,
    operation_ref: PUBLISH_OPERATION_REF,
    surface: "EVENT",
    kind: "EVENT_PUBLISH",
    method_ref: "publish_business_event",
  });

  const context = contextFor(PUBLISH_OPERATION_REF);
  assert.deepEqual(
    await publish_business_event(
      PUBLISH_INTERFACE_REF,
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
    interface_ref: PUBLISH_INTERFACE_REF,
    operation_ref: PUBLISH_OPERATION_REF,
    input: { authoritative_fact: "ready" },
    runtime_context: context,
  });

  await assert.rejects(
    () => consume_business_event(PUBLISH_INTERFACE_REF, {}, context),
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
      PUBLISH_INTERFACE_REF,
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
