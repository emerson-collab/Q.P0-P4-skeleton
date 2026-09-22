import { deep_freeze } from "../src/p0/runtime_contract.ts";
import type {
  P1OwnerLocalRuntimeBindingIdentity,
  P1OwnerLocalRuntimeBindingResolution,
  P1OwnerLocalRuntimeBindingResolver,
} from "./p1_owner_local_runtime_binding.ts";
import type {
  P2GoogleDriveMaterialLocator,
  P2GoogleDriveMaterialStore,
} from "./p2_google_drive_material_store.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export type P1DynamicVariableSourceKind =
  | "CONTRACT_GENERAL_FACT"
  | "INSTANCE_PARAMETER"
  | "INSTANCE_BINDING";

/**
 * One already-governed dynamic-variable binding projection.
 *
 * Selection authority is upstream. This runtime support must not infer a
 * Capability, Operation, Interface, source kind, source lineage, material
 * location, revision, or hash.
 */
export interface P1DynamicVariableRuntimeBinding {
  readonly binding_ref: string;
  readonly variable_ref: string;
  readonly source_kind: P1DynamicVariableSourceKind;
  readonly source_lineage: JsonObject;
  readonly material_ref: string;
  readonly locator: P2GoogleDriveMaterialLocator;
}

export interface P1DynamicVariableRuntimeBindingPort {
  resolveExact(
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  ):
    | P1DynamicVariableRuntimeBinding
    | undefined
    | Promise<P1DynamicVariableRuntimeBinding | undefined>;
}

/**
 * Host-local exact runtime reference resolution.
 *
 * The resolver receives verified JSON material and may resolve only the exact
 * references already present in that material. It must not add Capability,
 * Operation, Interface, provider-selection, rule, verdict, or second-runtime
 * semantics.
 */
export interface P1RuntimeReferenceResolver {
  resolveExact(input: Readonly<{
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>;
    binding: Readonly<P1DynamicVariableRuntimeBinding>;
    runtime_material: JsonObject;
  }>): JsonObject | Promise<JsonObject>;
}

export interface P1DynamicVariableRuntimeResolverOptions {
  readonly binding_port: P1DynamicVariableRuntimeBindingPort;
  readonly material_store: P2GoogleDriveMaterialStore;
  readonly reference_resolver: P1RuntimeReferenceResolver;
  readonly trace_id: string;
  readonly request_id: string;
}

const SOURCE_KINDS = Object.freeze([
  "CONTRACT_GENERAL_FACT",
  "INSTANCE_PARAMETER",
  "INSTANCE_BINDING",
] as const);

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function jsonObject(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as JsonObject;
}

function exactSha256(value: unknown, field: string): string {
  const text = nonEmptyString(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new TypeError(`${field} must be an exact sha256 binding`);
  }
  return text;
}

function exactSourceKind(value: unknown): P1DynamicVariableSourceKind {
  if (!(SOURCE_KINDS as readonly unknown[]).includes(value)) {
    throw new TypeError(
      "source_kind must be CONTRACT_GENERAL_FACT, INSTANCE_PARAMETER, or INSTANCE_BINDING",
    );
  }
  return value as P1DynamicVariableSourceKind;
}

function validateLocator(locator: P2GoogleDriveMaterialLocator): void {
  if (locator.provider !== "GOOGLE_DRIVE") {
    throw new TypeError("runtime material locator provider must be GOOGLE_DRIVE");
  }
  if (locator.data_category !== "RUNTIME") {
    throw new TypeError("dynamic-variable runtime resolver requires RUNTIME material");
  }
  nonEmptyString(locator.root_folder_id, "locator.root_folder_id");
  nonEmptyString(locator.owner_folder_id, "locator.owner_folder_id");
  nonEmptyString(locator.subject_folder_id, "locator.subject_folder_id");
  nonEmptyString(locator.file_id, "locator.file_id");
  nonEmptyString(locator.revision_id, "locator.revision_id");
  if (locator.file_name !== "runtime.json") {
    throw new TypeError("RUNTIME material locator must bind runtime.json");
  }
  nonEmptyString(locator.owner_ref, "locator.owner_ref");
  nonEmptyString(locator.subject_ref, "locator.subject_ref");
  exactSha256(locator.content_hash, "locator.content_hash");
}

function validateBinding(
  binding: P1DynamicVariableRuntimeBinding,
): P1DynamicVariableRuntimeBinding {
  nonEmptyString(binding.binding_ref, "binding.binding_ref");
  nonEmptyString(binding.variable_ref, "binding.variable_ref");
  exactSourceKind(binding.source_kind);
  const lineage = jsonObject(binding.source_lineage, "binding.source_lineage");
  if (Object.keys(lineage).length === 0) {
    throw new TypeError("binding.source_lineage must preserve exact governed lineage");
  }
  nonEmptyString(binding.material_ref, "binding.material_ref");
  validateLocator(binding.locator);
  return binding;
}

function parseRuntimeMaterial(bytes: Uint8Array): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new TypeError("runtime material must be valid JSON");
  }
  return jsonObject(parsed, "runtime_material");
}

/**
 * Creates the generic P1 owner-local resolver backed by one already-governed
 * dynamic-variable binding and exact P2 RUNTIME material.
 *
 * This function deliberately owns no Domain-specific semantics. The existing
 * P2 Google Drive store performs exact file/revision/hash verification, while
 * the injected reference resolver resolves only references present in the
 * verified runtime material into in-process P0 attributes.
 */
export function createP1DynamicVariableRuntimeResolver(
  options: Readonly<P1DynamicVariableRuntimeResolverOptions>,
): P1OwnerLocalRuntimeBindingResolver {
  const traceId = nonEmptyString(options.trace_id, "trace_id");
  const requestId = nonEmptyString(options.request_id, "request_id");

  return Object.freeze({
    async resolveExact(
      identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
    ): Promise<P1OwnerLocalRuntimeBindingResolution | undefined> {
      const binding = await options.binding_port.resolveExact(identity);
      if (binding === undefined) return undefined;

      const exactBinding = validateBinding(binding);
      const bytes = await options.material_store.readExact({
        locator: exactBinding.locator,
        trace_id: traceId,
        request_id: requestId,
      });
      const runtimeMaterial = parseRuntimeMaterial(bytes);
      const attributes = jsonObject(
        await options.reference_resolver.resolveExact(
          deep_freeze({
            identity,
            binding: exactBinding,
            runtime_material: runtimeMaterial,
          }),
        ),
        "runtime_reference_resolution",
      );

      return deep_freeze({
        attributes: { ...attributes },
      });
    },
  });
}
