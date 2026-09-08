import {
  PERSISTENCE_COMPILER_PROFILE_HASH,
  PERSISTENCE_COMPILER_PROFILE_REF,
  compileCapabilityPersistenceSchema,
  sha256ExactBytes,
} from "./persistence_schema_compiler.ts";
import type { InstancePersistenceBinding, JsonObject } from "./persistence_schema_compiler.ts";
import { applyCapabilityPersistenceSchema } from "./persistence_schema_apply.ts";
import type { SchemaApplyDependencies, SchemaApplyResult } from "./persistence_schema_apply.ts";

export type PersistenceActivationStatus = "NOT_REQUIRED" | "SATISFIED";
export interface CapabilityPersistenceActivationInput {
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly source_capability_contract_bytes: Uint8Array;
  readonly capability_contract: JsonObject;
  readonly instance_persistence_binding?: InstancePersistenceBinding;
}
export interface CapabilityPersistenceActivationResult {
  readonly status: PersistenceActivationStatus;
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly database_instance_ref?: string;
  readonly schema_apply_result?: SchemaApplyResult;
}
export type PersistenceActivationDependencies = Omit<SchemaApplyDependencies, "source_reader">;

export class PersistenceActivationError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PersistenceActivationError";
    this.code = code;
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function persistenceRequired(contract: JsonObject): boolean {
  if (!isObject(contract.persistence_requirements)) throw new PersistenceActivationError("P1_PERSISTENCE_ACTIVATION_INPUT_INVALID", "persistence_requirements is required");
  return contract.persistence_requirements.persistence_required === true;
}
/** Governed automatic trigger used by Capability overlay/instance activation. Never call from process startup or Operation invocation. */
export async function materializeCapabilityPersistenceForActivation(
  input: CapabilityPersistenceActivationInput,
  dependencies: PersistenceActivationDependencies,
): Promise<CapabilityPersistenceActivationResult> {
  if (sha256ExactBytes(input.source_capability_contract_bytes) !== input.source_capability_contract_hash) {
    throw new PersistenceActivationError("P1_PERSISTENCE_ACTIVATION_SOURCE_HASH_MISMATCH", "frozen Capability Contract bytes do not match exact source hash");
  }
  if (!persistenceRequired(input.capability_contract)) {
    return Object.freeze({
      status: "NOT_REQUIRED",
      source_capability_contract_ref: input.source_capability_contract_ref,
      source_capability_contract_hash: input.source_capability_contract_hash,
    });
  }
  if (input.instance_persistence_binding === undefined) {
    throw new PersistenceActivationError("P1_PERSISTENCE_ACTIVATION_BINDING_REQUIRED", "persistent Capability activation requires exact instance persistence binding");
  }
  const schemaDefinition = compileCapabilityPersistenceSchema({
    source_capability_contract_ref: input.source_capability_contract_ref,
    source_capability_contract_hash: input.source_capability_contract_hash,
    capability_contract: input.capability_contract,
    instance_persistence_binding: input.instance_persistence_binding,
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
  });
  const frozenBytes = new Uint8Array(input.source_capability_contract_bytes);
  const applyResult = await applyCapabilityPersistenceSchema(schemaDefinition, {
    ...dependencies,
    source_reader: {
      async readExact(request) {
        if (request.source_ref !== input.source_capability_contract_ref || request.source_hash !== input.source_capability_contract_hash) {
          throw new PersistenceActivationError("P1_PERSISTENCE_ACTIVATION_SOURCE_IDENTITY_MISMATCH", "Schema Apply requested different Capability Source identity");
        }
        return new Uint8Array(frozenBytes);
      },
    },
  });
  if (applyResult.migration_receipt.payload.execution_status !== "APPLIED") {
    throw new PersistenceActivationError("P1_PERSISTENCE_ACTIVATION_NOT_APPLIED", "persistent Capability cannot become invocation-eligible without APPLIED receipt");
  }
  return Object.freeze({
    status: "SATISFIED",
    source_capability_contract_ref: input.source_capability_contract_ref,
    source_capability_contract_hash: input.source_capability_contract_hash,
    database_instance_ref: input.instance_persistence_binding.database_instance_ref,
    schema_apply_result: applyResult,
  });
}
