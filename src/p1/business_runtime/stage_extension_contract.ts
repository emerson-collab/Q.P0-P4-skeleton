import { P0_CONTRACT_REF, P0_PROVIDER_SYMBOL_REF, deep_freeze, exact_ref } from "../../p0/runtime_contract.ts";
import type { StageExtensionContract } from "../../p0/runtime_contract.ts";

export const P1_CONTRACT_REF = "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0183" as const;
export const P1_CAPABILITY_CONTRACT_STANDARD_REF = "Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0119" as const;

export const P1_CAPABILITY_GENERAL_SLOT_IDS = [
  "capability_ref",
  "capability_id",
  "capability_version",
  "capability_contract_ref",
  "capability_contract_content_hash",
  "stage_contract_ref",
  "runtime_contract_ref",
  "operation_id",
  "operation_ref",
  "interface_ref",
  "surface",
  "kind",
  "method_ref",
] as const;

export type P1CapabilityGeneralSlotId = (typeof P1_CAPABILITY_GENERAL_SLOT_IDS)[number];

export const P1_CAPABILITY_GENERAL_SLOT_REFS = deep_freeze(
  Object.fromEntries(
    P1_CAPABILITY_GENERAL_SLOT_IDS.map((slotId) => [
      slotId,
      `${P1_CONTRACT_REF}#/overlay_slot_catalog/capability_general_slots/${slotId}`,
    ]),
  ) as Record<P1CapabilityGeneralSlotId, string>,
);

export interface P1CapabilityGeneralFacts {
  readonly capability_ref: string;
  readonly capability_id: string;
  readonly capability_version: string;
  readonly capability_contract_ref: string;
  readonly capability_contract_content_hash: string;
  readonly stage_contract_ref: string;
  readonly runtime_contract_ref: string;
  readonly operation_id: string;
  readonly operation_ref: string;
  readonly interface_ref: string;
  readonly surface: string;
  readonly kind: string;
  readonly method_ref: string;
}

export interface P1CapabilityGeneralSlotBinding {
  readonly slot_ref: string;
  readonly value: string;
}

export type P1CapabilityGeneralSlotProjection = Readonly<
  Record<P1CapabilityGeneralSlotId, Readonly<P1CapabilityGeneralSlotBinding>>
>;

function required(value: string, field: string): string {
  if (value.length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

export function project_p1_capability_general_slots(
  facts: Readonly<P1CapabilityGeneralFacts>,
): P1CapabilityGeneralSlotProjection {
  for (const slotId of P1_CAPABILITY_GENERAL_SLOT_IDS) required(facts[slotId], slotId);

  if (!exact_ref(facts.capability_ref) || facts.capability_ref.includes("#/")) {
    throw new TypeError("capability_ref must be an exact versioned Capability ref");
  }
  if (!exact_ref(facts.capability_contract_ref) || facts.capability_contract_ref.includes("#/")) {
    throw new TypeError("capability_contract_ref must be an exact versioned Capability Contract ref");
  }
  if (!/^V\d{4}$/.test(facts.capability_version)) {
    throw new TypeError("capability_version must be Vdddd");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(facts.capability_contract_content_hash)) {
    throw new TypeError("capability_contract_content_hash must be an exact sha256 hash");
  }
  if (facts.stage_contract_ref !== P1_CONTRACT_REF) {
    throw new TypeError("stage_contract_ref must equal the active P1 Business Runtime Contract");
  }
  if (facts.runtime_contract_ref !== P0_CONTRACT_REF) {
    throw new TypeError("runtime_contract_ref must equal the sole P0 Runtime Contract");
  }
  if (!exact_ref(facts.operation_ref)) {
    throw new TypeError("operation_ref must be an exact versioned Operation ref");
  }
  if (
    !exact_ref(facts.interface_ref)
    || !facts.interface_ref.startsWith(`${facts.capability_contract_ref}#/interfaces/`)
  ) {
    throw new TypeError("interface_ref must be an exact member of capability_contract_ref");
  }

  return deep_freeze(
    Object.fromEntries(
      P1_CAPABILITY_GENERAL_SLOT_IDS.map((slotId) => [
        slotId,
        {
          slot_ref: P1_CAPABILITY_GENERAL_SLOT_REFS[slotId],
          value: facts[slotId],
        },
      ]),
    ) as Record<P1CapabilityGeneralSlotId, P1CapabilityGeneralSlotBinding>,
  );
}

export interface P1CapabilityOverlayBinding {
  readonly general_slots: P1CapabilityGeneralSlotProjection;
  readonly implementation_ref: string;
  readonly provided_interface_refs: readonly string[];
  readonly hook_consumer_refs?: readonly string[];
  readonly hook_binding_refs?: readonly string[];
  readonly port_refs?: readonly string[];
}

function assertExactSlot(
  projection: P1CapabilityGeneralSlotProjection,
  slotId: P1CapabilityGeneralSlotId,
): string {
  const binding = projection[slotId];
  if (binding.slot_ref !== P1_CAPABILITY_GENERAL_SLOT_REFS[slotId]) {
    throw new TypeError(`${slotId} must bind its exact predeclared P1 V0183 slot_ref`);
  }
  return required(binding.value, slotId);
}

export function create_p1_capability_stage_extension(
  binding: P1CapabilityOverlayBinding,
): StageExtensionContract {
  const capabilityContractRef = assertExactSlot(binding.general_slots, "capability_contract_ref");
  const interfaceRef = assertExactSlot(binding.general_slots, "interface_ref");
  assertExactSlot(binding.general_slots, "operation_ref");
  assertExactSlot(binding.general_slots, "surface");
  assertExactSlot(binding.general_slots, "kind");
  assertExactSlot(binding.general_slots, "method_ref");

  if (binding.implementation_ref !== capabilityContractRef) {
    throw new TypeError("implementation_ref must equal the exact bound Capability Contract ref");
  }
  if (!binding.provided_interface_refs.includes(interfaceRef)) {
    throw new TypeError("provided_interface_refs must include the exact bound interface_ref");
  }

  return deep_freeze({
    stage_id: "P1",
    stage_role: "NONE",
    stage_contract_ref: P1_CONTRACT_REF,
    implementation_ref: binding.implementation_ref,
    provided_interface_refs: [...binding.provided_interface_refs],
    consumed_interface_refs: [`${P0_CONTRACT_REF}#/interfaces/runtime_execution_invoke`],
    hook_consumer_refs: [...(binding.hook_consumer_refs ?? [])],
    hook_binding_refs: [...(binding.hook_binding_refs ?? [])],
    port_refs: [...(binding.port_refs ?? [])],
    upstream_runtime_ref: P0_CONTRACT_REF,
    runtime_provider_symbol_ref: P0_PROVIDER_SYMBOL_REF,
    status: "active",
    rule_version_ref: P1_CONTRACT_REF,
  });
}
