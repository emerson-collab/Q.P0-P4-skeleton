import { deep_freeze } from "../src/p0/runtime_contract.ts";
import type {
  P1OwnerLocalRuntimeBindingIdentity,
  P1OwnerLocalRuntimeBindingResolver,
} from "./p1_owner_local_runtime_binding.ts";
import type {
  JsonObject,
  P2GoogleDriveMaterialLocator,
  P2GoogleDriveMaterialStore,
} from "./p2_google_drive_material_store.ts";

export interface P2RuntimeMaterialBinding {
  readonly material_ref: string;
  readonly content_hash: string;
  readonly locator: P2GoogleDriveMaterialLocator;
}

export interface P2RuntimeMaterialBindingResolver {
  resolveExact(
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  ):
    | P2RuntimeMaterialBinding
    | undefined
    | Promise<P2RuntimeMaterialBinding | undefined>;
}

export interface P2RuntimeMaterialAttributeFactory {
  materializeExact(input: Readonly<{
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>;
    binding: Readonly<P2RuntimeMaterialBinding>;
    runtime_material: JsonObject;
  }>): JsonObject | Promise<JsonObject>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function objectValue(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as JsonObject;
}

function parseRuntimeMaterial(bytes: Uint8Array): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new TypeError("P2 runtime material must be valid JSON");
  }
  return objectValue(parsed, "runtime_material");
}

/**
 * Repository-runtime support that backs the existing exact P1 owner-local
 * runtime binding resolver with one already-governed P2 RUNTIME material.
 *
 * This helper does not select a provider, Capability, Operation, Interface,
 * binding set, material_ref, or storage locator. Those must be resolved by the
 * supplied exact binding resolver. It only exact-reads the selected runtime
 * material, verifies its storage hash through the material store, and lets the
 * owning runtime implementation instantiate executable in-process attributes.
 */
export function createP2RuntimeMaterialBackedP1Resolver(
  options: Readonly<{
    binding_resolver: P2RuntimeMaterialBindingResolver;
    material_store: P2GoogleDriveMaterialStore;
    attribute_factory: P2RuntimeMaterialAttributeFactory;
    trace_id: string;
    request_id: string;
  }>,
): P1OwnerLocalRuntimeBindingResolver {
  const traceId = nonEmptyString(options.trace_id, "trace_id");
  const requestId = nonEmptyString(options.request_id, "request_id");

  return Object.freeze({
    async resolveExact(
      identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
    ) {
      const binding = await options.binding_resolver.resolveExact(identity);
      if (binding === undefined) return undefined;

      nonEmptyString(binding.material_ref, "runtime_material_binding.material_ref");
      nonEmptyString(binding.content_hash, "runtime_material_binding.content_hash");
      if (binding.locator.data_category !== "RUNTIME") {
        throw new TypeError("runtime material binding must resolve a RUNTIME locator");
      }
      if (binding.locator.content_hash !== binding.content_hash) {
        throw new TypeError(
          "runtime material binding content_hash must equal locator content_hash",
        );
      }

      const exactBytes = await options.material_store.readExact({
        locator: binding.locator,
        trace_id: traceId,
        request_id: requestId,
      });
      const runtimeMaterial = parseRuntimeMaterial(exactBytes);
      const attributes = objectValue(
        await options.attribute_factory.materializeExact(
          deep_freeze({
            identity,
            binding,
            runtime_material: runtimeMaterial,
          }),
        ),
        "owner_local_runtime_attributes",
      );

      return deep_freeze({
        attributes: { ...attributes },
      });
    },
  });
}
