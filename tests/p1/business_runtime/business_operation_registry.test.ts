import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeContext } from "../../../src/p0/runtime_contract.ts";
import {
  invoke_business_operation,
  register_business_operation,
  registered_business_operation_refs,
  resolve_business_operation,
} from "../../../src/p1/business_runtime/business_operation_registry.ts";

const OPERATION_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/example";
const CONTEXT: RuntimeContext = Object.freeze({
  stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0179",
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
