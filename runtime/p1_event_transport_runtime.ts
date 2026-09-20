import {
  StableRuntimeError,
  deep_freeze,
  exact_ref,
} from "../src/p0/runtime_contract.ts";
import type { RuntimeContext } from "../src/p0/runtime_contract.ts";
import { consume_business_event } from "../src/p1/business_runtime/business_operation_registry.ts";

/**
 * One EVENT delivery into the fixed P1 skeleton.
 *
 * `input` and `runtime_context` are existing P1/P0 DYNAMIC_MOUNT material.
 * This path does not resolve or materialize a Capability Instance and does not
 * read instance_parameters.qconfig or instance_bindings.qreg.
 */
export interface P1EventTransportDelivery {
  readonly interface_ref: string;
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
}

export interface P1EventTransportSession {
  receive(): Promise<P1EventTransportDelivery>;
  close(): void | Promise<void>;
}

export interface P1EventTransportConnector {
  connect(): Promise<P1EventTransportSession>;
  waitBeforeReconnect?(error: unknown): void | Promise<void>;
}

export interface P1EventTransportRuntimeController {
  readonly ready: Promise<void>;
  readonly stopped: Promise<void>;
  stop(): Promise<void>;
}

/**
 * Starts non-semantic EVENT transport support under the existing repository
 * `runtime/` root.
 *
 * The transport only supplies the exact EVENT Interface identity and dynamic
 * mount values to the fixed P1 skeleton. Exact Interface -> existing Operation
 * resolution is owned by business_operation_registry; transport/provider/channel
 * identity cannot select an Operation.
 *
 * Connection failures may reconnect. Interface/binding/dispatch failures are
 * semantic failures and fail closed instead of entering the reconnect path.
 */
export function start_p1_event_transport_runtime(
  connector: P1EventTransportConnector,
): P1EventTransportRuntimeController {
  let stopRequested = false;
  let activeSession: P1EventTransportSession | undefined;
  let readyResolved = false;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const stopped = (async () => {
    while (!stopRequested) {
      let session: P1EventTransportSession;
      try {
        session = await connector.connect();
      } catch (error) {
        if (stopRequested) break;
        if (connector.waitBeforeReconnect !== undefined) {
          await connector.waitBeforeReconnect(error);
        }
        continue;
      }

      try {
        if (stopRequested) {
          await session.close();
          break;
        }
        activeSession = session;
        if (!readyResolved) {
          readyResolved = true;
          resolveReady();
        }

        let reconnect = false;
        while (!stopRequested) {
          let delivery: P1EventTransportDelivery;
          try {
            delivery = await session.receive();
          } catch (error) {
            if (stopRequested) break;
            if (connector.waitBeforeReconnect !== undefined) {
              await connector.waitBeforeReconnect(error);
            }
            reconnect = true;
            break;
          }

          if (!exact_ref(delivery.interface_ref)) {
            throw new StableRuntimeError(
              "P1_EVENT_DELIVERY_INTERFACE_INVALID",
              "Transport delivery interface_ref must be exact-versioned",
            );
          }

          await consume_business_event(
            delivery.interface_ref,
            delivery.input,
            delivery.runtime_context,
          );
        }

        if (!reconnect && !stopRequested) {
          throw new StableRuntimeError(
            "P1_EVENT_TRANSPORT_STOPPED",
            "EVENT transport session stopped without a transport disconnect or requested shutdown",
          );
        }
      } finally {
        if (activeSession === session) {
          activeSession = undefined;
          await session.close();
        }
      }
    }
  })();

  return deep_freeze({
    ready,
    stopped,
    async stop(): Promise<void> {
      if (stopRequested) {
        await stopped;
        return;
      }
      stopRequested = true;
      if (activeSession !== undefined) {
        const session = activeSession;
        activeSession = undefined;
        await session.close();
      }
      await stopped;
    },
  } satisfies P1EventTransportRuntimeController);
}
