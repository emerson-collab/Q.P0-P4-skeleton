import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeContext } from "../../../src/p0/runtime_contract.ts";
import { consume_business_event } from "../../../src/p1/business_runtime/business_operation_registry.ts";
import {
  connect_p1_capability_event_runtime,
  resolve_p1_capability_code_variables,
  type P1CapabilityCodeVariableSource,
} from "../../../runtime/p1_capability_dynamic_variable_binding.ts";

function sourceFor(code: string): P1CapabilityCodeVariableSource {
  const contractRef = `Q.TEST.CONTRACT.CAPABILITY.${code}@V0100`;
  return Object.freeze({
    exact_source_capability_contract_ref: contractRef,
    exact_source_capability_contract_hash: `sha256:${"a".repeat(64)}`,
    general_facts: Object.freeze({
      capability_contract_ref: contractRef,
      capability_id: code.toLowerCase(),
      operation_ref: `${contractRef}#/operations/consume_registered_event`,
      event_interface_ref: `${contractRef}#/interfaces/standard_registration_consume`,
      event_interface_kind: "EVENT_CONSUME",
      event_method_ref: "consume_business_event",
    }),
  });
}

test("Skeleton connects exact P1 Capability GENERAL code variables to EVENT runtime tokens", async () => {
  const source = sourceFor("DYNAMIC_EVENT");
  let seenInput: unknown;
  let seenOperationRef: string | undefined;

  const connection = connect_p1_capability_event_runtime(
    source,
    async (input, context) => {
      seenInput = input;
      seenOperationRef = context.operation_ref;
      return { ok: true };
    },
  );

  assert.equal(connection.capability_id, "dynamic_event");
  assert.equal(connection.token_bindings.length, 6);

  const runtimeContext: RuntimeContext = Object.freeze({
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
    operation_ref: "Q.TEST.CONTRACT.CAPABILITY.DYNAMIC_EVENT@V0100#/operations/transport_must_not_select",
    trace_id: "trace:dynamic",
    request_id: "request:dynamic",
    invocation_id: "invocation:dynamic",
    binding_set_ref: "binding:dynamic",
  });

  assert.deepEqual(
    await consume_business_event(
      String(source.general_facts.event_interface_ref),
      Object.freeze({ event_id: "event:dynamic" }),
      runtimeContext,
    ),
    { ok: true },
  );
  assert.deepEqual(seenInput, { event_id: "event:dynamic" });
  assert.equal(seenOperationRef, source.general_facts.operation_ref);
});

test("Skeleton dynamic-variable binding fails closed when one required GENERAL fact is absent", () => {
  const source = sourceFor("MISSING_FACT");
  const { event_method_ref: _removed, ...generalFacts } = source.general_facts;
  assert.throws(
    () => connect_p1_capability_event_runtime(
      { ...source, general_facts: Object.freeze(generalFacts) },
      async () => undefined,
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_DYNAMIC_VARIABLE_BINDING_UNRESOLVED",
  );
});

test("Skeleton dynamic-variable binding rejects duplicate predeclared target variables", () => {
  const source = sourceFor("AMBIGUOUS");
  assert.throws(
    () => resolve_p1_capability_code_variables(
      source,
      [
        {
          token_ref: "runtime:test:a",
          variable_id: "same",
          source_kind: "CONTRACT_GENERAL_FACT",
          source_fact_key: "capability_id",
        },
        {
          token_ref: "runtime:test:b",
          variable_id: "same",
          source_kind: "CONTRACT_GENERAL_FACT",
          source_fact_key: "operation_ref",
        },
      ],
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_DYNAMIC_VARIABLE_BINDING_AMBIGUOUS",
  );
});

test("Skeleton dynamic-variable binding rejects a cross-Contract Operation projection", () => {
  const source = sourceFor("CROSS_CONTRACT");
  assert.throws(
    () => connect_p1_capability_event_runtime(
      {
        ...source,
        general_facts: Object.freeze({
          ...source.general_facts,
          operation_ref: "Q.TEST.CONTRACT.CAPABILITY.OTHER@V0100#/operations/consume_registered_event",
        }),
      },
      async () => undefined,
    ),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
  );
});
