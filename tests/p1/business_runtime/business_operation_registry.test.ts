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
const CONSUME_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_consume`;
const PUBLISH_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_publish`;
const CONTEXT: RuntimeContext = Object.freeze({
  stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
  operation_ref: OPERATION_REF,
  trace_id: "trace:test",
  request_id: "request:test",
  invocation_id: "invocation:test",
  binding_set_ref: "binding:test",
  attributes: Object.freeze({ injected: "yes" }),
});

test("P1 business operation registry preserves RuntimeContext during invocation", async () => {
  const handler = async (input: unknown, context: RuntimeContext) => ({
    input,
    operation_ref: context.operation_ref,
    binding_set_ref: context.binding_set_ref,
    injected: context.attributes?.injected,
  });

  register_business_operation(OPERATION_REF, handler);

  assert.equal(resolve_business_operation(OPERATION_REF), handler);
  assert.ok(registered_business_operation_refs().includes(OPERATION_REF));
  assert.deepEqual(
    await invoke_business_operation(OPERATION_REF, { value: 1 }, CONTEXT),
    {
      input: { value: 1 },
      operation_ref: OPERATION_REF,
      binding_set_ref: "binding:test",
      injected: "yes",
    },
  );
});

test("P1 business operation registry fails closed on duplicate different handler", () => {
  const ref = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/duplicate";
  register_business_operation(ref, async () => "first");
  assert.throws(
    () => register_business_operation(ref, async () => "second"),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_OPERATION_DUPLICATE",
  );
});

test("P1 EVENT_CONSUME dispatches only through exact Interface-to-existing-Operation binding", async () => {
  register_business_operation(OPERATION_REF, async (input) => ({ consumed: input }));
  const binding = register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: CONSUME_INTERFACE_REF,
    operation_ref: OPERATION_REF,
    surface: "EVENT",
    kind: "EVENT_CONSUME",
    method_ref: "consume_business_event",
  });

  assert.equal(resolve_business_event_interface(CONSUME_INTERFACE_REF), binding);
  assert.ok(registered_business_event_interface_refs().includes(CONSUME_INTERFACE_REF));
  assert.deepEqual(
    await consume_business_event(CONSUME_INTERFACE_REF, { id: 7 }, CONTEXT),
    { consumed: { id: 7 } },
  );
  await assert.rejects(
    () => consume_business_event(OPERATION_REF, { id: 7 }, CONTEXT),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_NOT_REGISTERED",
  );
});

test("P1 EVENT binding rejects transport/caller Operation override and kind mismatch", async () => {
  register_business_operation(OPERATION_REF, async () => "ok");
  register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: PUBLISH_INTERFACE_REF,
    operation_ref: OPERATION_REF,
    surface: "EVENT",
    kind: "EVENT_PUBLISH",
    method_ref: "publish_business_event",
  });

  assert.equal(await publish_business_event(PUBLISH_INTERFACE_REF, {}, CONTEXT), "ok");
  await assert.rejects(
    () => consume_business_event(PUBLISH_INTERFACE_REF, {}, CONTEXT),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_KIND_MISMATCH",
  );

  const wrongContext = Object.freeze({
    ...CONTEXT,
    operation_ref: `${CAPABILITY_REF}#/operations/other`,
  });
  await assert.rejects(
    () => publish_business_event(PUBLISH_INTERFACE_REF, {}, wrongContext),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_RUNTIME_CONTEXT_OPERATION_MISMATCH",
  );
});
