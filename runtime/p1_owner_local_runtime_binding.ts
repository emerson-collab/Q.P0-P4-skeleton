import {
  StableRuntimeError,
  deep_freeze,
  exact_ref,
} from "../src/p0/runtime_contract.ts";
import type { RuntimeContext } from "../src/p0/runtime_contract.ts";
import { consume_business_event } from "../src/p1/business_runtime/business_operation_registry.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface P1OwnerLocalRuntimeBindingIdentity {
  readonly capability_contract_ref: string;
  readonly operation_ref: string;
  readonly interface_ref: string;
  readonly binding_set_ref: string;
  readonly port_refs: readonly string[];
}

export interface P1OwnerLocalRuntimeBindingResolution {
  readonly attributes: JsonObject;
}

export interface P1OwnerLocalRuntimeBindingResolver {
  resolveExact(
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  ):
    | P1OwnerLocalRuntimeBindingResolution
    | undefined
    | Promise<P1OwnerLocalRuntimeBindingResolution | undefined>;
}

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

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function exactCapabilityMember(
  capabilityContractRef: string,
  memberRef: string,
  memberKind: "operations" | "interfaces",
  field: string,
): string {
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/${memberKind}/`)) {
    throw new TypeError(`${field} must be an exact member of capability_contract_ref`);
  }
  return exact;
}

function attributesObject(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("owner-local runtime binding attributes must be an object");
  }
  return value as JsonObject;
}

/**
 * Repository-runtime support for resolving one already-selected owner-local P1 binding.
 *
 * Capability Instance / binding authority selects binding_set_ref and port_refs before
 * runtime resolution. This helper owns no Capability, Operation, Interface, Port,
 * Provider, or binding selection semantics; it only resolves opaque runtime resources
 * for the exact already-governed identity supplied by the receiving repository.
 */
export async function resolve_p1_owner_local_runtime_binding(
  identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  resolver: P1OwnerLocalRuntimeBindingResolver,
): Promise<P1OwnerLocalRuntimeBindingResolution | undefined> {
  const capabilityContractRef = nonEmptyString(
    identity.capability_contract_ref,
    "capability_contract_ref",
  );
  if (!exact_ref(capabilityContractRef)) {
    throw new TypeError("capability_contract_ref must be exact-versioned");
  }

  const exactIdentity = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    operation_ref: exactCapabilityMember(
      capabilityContractRef,
      identity.operation_ref,
      "operations",
      "operation_ref",
    ),
    interface_ref: exactCapabilityMember(
      capabilityContractRef,
      identity.interface_ref,
      "interfaces",
      "interface_ref",
    ),
    binding_set_ref: nonEmptyString(identity.binding_set_ref, "binding_set_ref"),
    port_refs: identity.port_refs.map((value, index) =>
      nonEmptyString(value, `port_refs[${index}]`)
    ),
  } satisfies P1OwnerLocalRuntimeBindingIdentity);

  const resolved = await resolver.resolveExact(exactIdentity);
  if (resolved === undefined) return undefined;

  return deep_freeze({
    attributes: { ...attributesObject(resolved.attributes) },
  });
}

/**
 * Starts one non-semantic EVENT transport lifecycle inside the existing repository
 * runtime-support root. The connector owns provider/channel mechanics; P1 owns only
 * exact Interface-to-Operation dispatch through consume_business_event.
 *
 * A broken session is closed and reconnected. No polling/cron worker, listener
 * business Operation, EVENT-specific directory, second Runtime, or P0 EVENT surface
 * is created here.
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

          // Dispatch/binding failures are semantic failures, not transport
          // disconnects. They intentionally escape this lifecycle and fail
          // closed instead of entering the reconnect path.
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
