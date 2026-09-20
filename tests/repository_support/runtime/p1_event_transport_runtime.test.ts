import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeContext } from "../../../src/p0/runtime_contract.ts";
import {
  register_business_event_interface,
  register_business_operation,
} from "../../../src/p1/business_runtime/business_operation_registry.ts";
import {
  start_p1_event_transport_runtime,
  type P1EventTransportConnector,
  type P1EventTransportDelivery,
  type P1EventTransportSession,
} from "../../../runtime/p1_event_transport_runtime.ts";

const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OPERATION_REF = `${CAPABILITY_REF}#/operations/read_example`;
const EVENT_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_consume`;

function dynamicRuntimeContext(suffix: string): RuntimeContext {
  return Object.freeze({
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
    operation_ref: `${CAPABILITY_REF}#/operations/transport_selected_should_be_ignored`,
    trace_id: `trace:${suffix}`,
    request_id: `request:${suffix}`,
    invocation_id: `invocation:${suffix}`,
    binding_set_ref: `hook-binding-set:${suffix}`,
    attributes: Object.freeze({
      dynamic_variable_source: "DIRECT_DYNAMIC_MOUNT",
    }),
  });
}

test("P1 EVENT runtime consumes direct DYNAMIC_MOUNT values without Capability Instance materialization", async () => {
  let handled: unknown;
  let handledContext: RuntimeContext | undefined;
  const context = dynamicRuntimeContext("event");

  register_business_operation(OPERATION_REF, async (input, runtimeContext) => {
    handled = input;
    handledContext = runtimeContext;
    return { ok: true };
  });
  register_business_event_interface({
    capability_contract_ref: CAPABILITY_REF,
    interface_ref: EVENT_INTERFACE_REF,
    operation_ref: OPERATION_REF,
    surface: "EVENT",
    kind: "EVENT_CONSUME",
    method_ref: "consume_business_event",
  });

  let connectCount = 0;
  let closeCount = 0;
  let releaseSecondReceive!: () => void;
  const secondReceiveBlocked = new Promise<void>((resolve) => {
    releaseSecondReceive = resolve;
  });

  const delivery: P1EventTransportDelivery = Object.freeze({
    interface_ref: EVENT_INTERFACE_REF,
    input: Object.freeze({ event_id: "event:test" }),
    runtime_context: context,
  });

  const connector: P1EventTransportConnector = Object.freeze({
    async connect(): Promise<P1EventTransportSession> {
      connectCount += 1;
      if (connectCount === 1) {
        return {
          async receive(): Promise<P1EventTransportDelivery> {
            throw new Error("simulated disconnect");
          },
          async close() {
            closeCount += 1;
          },
        };
      }

      let delivered = false;
      return {
        async receive(): Promise<P1EventTransportDelivery> {
          if (!delivered) {
            delivered = true;
            return delivery;
          }
          await secondReceiveBlocked;
          throw new Error("closed");
        },
        async close() {
          closeCount += 1;
          releaseSecondReceive();
        },
      };
    },
    async waitBeforeReconnect() {
      return;
    },
  });

  const controller = start_p1_event_transport_runtime(connector);
  await controller.ready;

  for (let i = 0; i < 20 && handled === undefined; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.deepEqual(handled, { event_id: "event:test" });
  assert.equal(connectCount, 2);
  assert.equal(handledContext?.operation_ref, OPERATION_REF);
  assert.equal(
    handledContext?.attributes?.dynamic_variable_source,
    "DIRECT_DYNAMIC_MOUNT",
  );

  await controller.stop();
  assert.ok(closeCount >= 2);
  await controller.stopped;
});

test("P1 EVENT runtime fails closed on undeclared exact Interface instead of reconnecting", async () => {
  const undeclaredInterfaceRef = `${CAPABILITY_REF}#/interfaces/undeclared_event_consume`;
  const context = dynamicRuntimeContext("undeclared");

  let connectCount = 0;
  let closeCount = 0;
  const connector: P1EventTransportConnector = Object.freeze({
    async connect(): Promise<P1EventTransportSession> {
      connectCount += 1;
      return {
        async receive(): Promise<P1EventTransportDelivery> {
          return Object.freeze({
            interface_ref: undeclaredInterfaceRef,
            input: Object.freeze({ event_id: "event:undeclared" }),
            runtime_context: context,
          });
        },
        async close() {
          closeCount += 1;
        },
      };
    },
    async waitBeforeReconnect() {
      throw new Error("semantic binding failure must not enter reconnect path");
    },
  });

  const controller = start_p1_event_transport_runtime(connector);
  await controller.ready;
  await assert.rejects(
    controller.stopped,
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code: string }).code === "P1_EVENT_INTERFACE_NOT_REGISTERED",
  );
  assert.equal(connectCount, 1);
  assert.equal(closeCount, 1);
});
