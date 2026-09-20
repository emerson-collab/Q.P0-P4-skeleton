import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeContext } from "../../../src/p0/runtime_contract.ts";
import {
  register_business_event_interface,
  register_business_operation,
} from "../../../src/p1/business_runtime/business_operation_registry.ts";
import {
  resolve_p1_owner_local_runtime_binding,
  start_p1_event_transport_runtime,
  type P1EventTransportConnector,
  type P1EventTransportDelivery,
  type P1EventTransportSession,
  type P1OwnerLocalRuntimeBindingIdentity,
  type P1OwnerLocalRuntimeBindingResolver,
} from "../../../runtime/p1_owner_local_runtime_binding.ts";

const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OPERATION_REF = `${CAPABILITY_REF}#/operations/read_example`;
const INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_read_invoke`;
const EVENT_INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_event_consume`;

const IDENTITY: P1OwnerLocalRuntimeBindingIdentity = Object.freeze({
  capability_contract_ref: CAPABILITY_REF,
  operation_ref: OPERATION_REF,
  interface_ref: INTERFACE_REF,
  binding_set_ref: "Q.CAPABILITY_INSTANCE.EXAMPLE.DEFAULT@V0100#binding_set",
  port_refs: Object.freeze(["Q.TEST.PORT.EXAMPLE@V0100"]),
});

test("owner-local P1 runtime binding preserves governed identity and resolves only opaque runtime attributes", async () => {
  let seen: Readonly<P1OwnerLocalRuntimeBindingIdentity> | undefined;
  const resolver: P1OwnerLocalRuntimeBindingResolver = Object.freeze({
    resolveExact(identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>) {
      seen = identity;
      return {
        attributes: {
          readExample: async () => ({ value: "ok" }),
        },
      };
    },
  });

  const resolved = await resolve_p1_owner_local_runtime_binding(IDENTITY, resolver);

  assert.deepEqual(seen, IDENTITY);
  assert.equal(typeof resolved?.attributes.readExample, "function");
  assert.ok(Object.isFrozen(resolved));
  assert.ok(Object.isFrozen(resolved?.attributes));
});

test("owner-local P1 runtime binding returns undefined when receiving repository has no exact binding", async () => {
  const resolved = await resolve_p1_owner_local_runtime_binding(
    IDENTITY,
    Object.freeze({
      resolveExact: (_identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>) => undefined,
    }),
  );
  assert.equal(resolved, undefined);
});

test("owner-local P1 runtime binding rejects cross-capability Operation or Interface identity", async () => {
  const resolver: P1OwnerLocalRuntimeBindingResolver = Object.freeze({
    resolveExact: (_identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>) => undefined,
  });
  await assert.rejects(
    () => resolve_p1_owner_local_runtime_binding(
      {
        ...IDENTITY,
        operation_ref: "Q.TEST.CONTRACT.CAPABILITY.OTHER@V0100#/operations/read_example",
      },
      resolver,
    ),
    /operation_ref must be an exact member of capability_contract_ref/,
  );
  await assert.rejects(
    () => resolve_p1_owner_local_runtime_binding(
      {
        ...IDENTITY,
        interface_ref: "Q.TEST.CONTRACT.CAPABILITY.OTHER@V0100#/interfaces/example_read_invoke",
      },
      resolver,
    ),
    /interface_ref must be an exact member of capability_contract_ref/,
  );
});

test("owner-local P1 runtime binding requires preselected binding_set_ref", async () => {
  const resolver: P1OwnerLocalRuntimeBindingResolver = Object.freeze({
    resolveExact: (_identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>) => undefined,
  });
  await assert.rejects(
    () => resolve_p1_owner_local_runtime_binding(
      {
        ...IDENTITY,
        binding_set_ref: "",
      },
      resolver,
    ),
    /binding_set_ref must be a non-empty string/,
  );
});

test("P1 EVENT runtime support reconnects transport and dispatches through exact EVENT Interface binding", async () => {
  let handled: unknown;
  const context: RuntimeContext = Object.freeze({
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
    operation_ref: `${CAPABILITY_REF}#/operations/transport_selected_should_be_ignored`,
    trace_id: "trace:event",
    request_id: "request:event",
    invocation_id: "invocation:event",
    binding_set_ref: "binding:event",
  });

  register_business_operation(OPERATION_REF, async (input) => {
    handled = input;
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

  await controller.stop();
  assert.ok(closeCount >= 2);
  await controller.stopped;
});
