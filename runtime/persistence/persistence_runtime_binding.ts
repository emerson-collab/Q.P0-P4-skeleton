import {
  instancePersistenceBindingHash,
  type InstancePersistenceBinding,
} from "../../src/p1/business_runtime/persistence_schema_compiler.ts";
import type {
  GovernedArtifactStore,
  MigrationReceiptIndex,
} from "../../src/p1/business_runtime/persistence_schema_apply.ts";
import type {
  CapabilityPersistenceActivationInput,
} from "../../src/p1/business_runtime/persistence_activation_coordinator.ts";
import {
  activate_p1_capability_stage_extension,
  type P1CapabilityActivationResult,
  type P1CapabilityOverlayBinding,
} from "../../src/p1/business_runtime/stage_extension_contract.ts";
import {
  createPostgresqlRelationalSchemaExecutor,
  PersistenceRuntimeBindingError,
  type PostgresqlSessionProvider,
} from "./postgresql_relational_executor.ts";

export interface P1PersistenceRuntimeBinding {
  readonly instance_persistence_binding: Readonly<InstancePersistenceBinding>;
  readonly postgresql_session_provider: PostgresqlSessionProvider;
  readonly artifact_store: GovernedArtifactStore;
  readonly migration_receipt_index: MigrationReceiptIndex;
}

export function persistenceRuntimeBindingHash(binding: P1PersistenceRuntimeBinding): string {
  return instancePersistenceBindingHash(binding.instance_persistence_binding);
}

export async function activateP1CapabilityWithRuntimeBinding(
  stageBinding: P1CapabilityOverlayBinding,
  persistenceInput: CapabilityPersistenceActivationInput,
  runtimeBinding: P1PersistenceRuntimeBinding,
): Promise<P1CapabilityActivationResult> {
  const declaredBinding = persistenceInput.instance_persistence_binding;
  if (
    declaredBinding !== undefined
    && instancePersistenceBindingHash(declaredBinding) !== instancePersistenceBindingHash(runtimeBinding.instance_persistence_binding)
  ) {
    throw new PersistenceRuntimeBindingError(
      "P1_RUNTIME_PERSISTENCE_BINDING_MISMATCH",
      "Capability activation instance persistence binding does not match the injected runtime binding",
    );
  }

  const effectiveInput: CapabilityPersistenceActivationInput = Object.freeze({
    ...persistenceInput,
    instance_persistence_binding: runtimeBinding.instance_persistence_binding,
  });
  const relationalExecutor = createPostgresqlRelationalSchemaExecutor(
    runtimeBinding.instance_persistence_binding,
    runtimeBinding.postgresql_session_provider,
  );

  return activate_p1_capability_stage_extension(
    stageBinding,
    effectiveInput,
    Object.freeze({
      artifact_store: runtimeBinding.artifact_store,
      relational_executor: relationalExecutor,
      migration_receipt_index: runtimeBinding.migration_receipt_index,
    }),
  );
}
