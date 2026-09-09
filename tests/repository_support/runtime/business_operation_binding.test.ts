import assert from "node:assert/strict";
import test from "node:test";
import {
  bindBusinessOperationPort,
  boundBusinessOperationRefs,
  invokeBoundBusinessOperation,
} from "../../../runtime/business_operation_binding.ts";

const operationRef = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/create_example";

test("runtime binds an Operation only through an explicit handler plus ports object", async () => {
  const ports = Object.freeze({ marker: "BOUND" });
  const handler = async (request: unknown, injectedPorts: unknown): Promise<unknown> => Object.freeze({ request, injectedPorts });

  bindBusinessOperationPort(Object.freeze({ operation_ref: operationRef, handler, ports }));
  bindBusinessOperationPort(Object.freeze({ operation_ref: operationRef, handler, ports }));

  assert.ok(boundBusinessOperationRefs().includes(operationRef));
  assert.deepEqual(
    await invokeBoundBusinessOperation(operationRef, Object.freeze({ value: 1 })),
    { request: { value: 1 }, injectedPorts: { marker: "BOUND" } },
  );
});

test("runtime fails closed instead of replacing an existing Operation port binding", () => {
  assert.throws(
    () => bindBusinessOperationPort(Object.freeze({
      operation_ref: operationRef,
      handler: async () => null,
      ports: Object.freeze({ marker: "OTHER" }),
    })),
    /already has a different explicit runtime port binding/,
  );
});
