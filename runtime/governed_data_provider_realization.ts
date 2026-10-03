import { StableRuntimeError, deep_freeze } from "../src/p0/runtime_contract.ts";
import {
  handler as exposeStaticData,
  type JsonObject as StaticJsonObject,
} from "../src/p2/provider/governed_data_exposure/expose_static_data/handler.ts";
import { handler as exposeDynamicData } from "../src/p2/provider/governed_data_exposure/expose_dynamic_data/handler.ts";
import { handler as exposeRuntimeData } from "../src/p2/provider/governed_data_exposure/expose_runtime_data/handler.ts";

export const REPOSITORY_SKELETON_REF =
  "Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0151" as const;
export const P1_CAPABILITY_MATERIALIZATION_REF =
  "Q.SS.STD.META.CONTRACT.P1_CAPABILITY_MATERIALIZATION@V0110" as const;
export const P1_BUSINESS_RUNTIME_REF =
  "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0184" as const;
export const P2_CONTRACT_REF =
  "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0125" as const;
export const GOVERNED_DATA_MATERIAL_REF =
  "Q.SS.STD.META.CONTRACT.GOVERNED_DATA_MATERIAL@V0104" as const;
export const GOVERNED_DATA_MATERIAL_PROGRAM_REF =
  `${GOVERNED_DATA_MATERIAL_REF}#/provider_materialization_program` as const;

export type GovernedDataCategory = "STATIC" | "DYNAMIC" | "RUNTIME";
export type SourceAccessKind =
  | "P1_AUTHORIZED_STATIC_OR_PACKAGE_FACT"
  | "DECLARED_Q_INTERFACE_SOURCE_FACT"
  | "AUTHORIZED_GOVERNED_STATE_OR_REGISTRY_FACT"
  | "ALREADY_PRODUCED_RUNTIME_FACT";

export interface GovernedDataHandoffMember {
  readonly member_ref: string;
  readonly source_fact_ref: string;
  readonly source_fact_authority_ref: string;
}

export interface GovernedDataHandoffBinding {
  readonly binding_ref: string;
  readonly data_category: GovernedDataCategory;
  readonly source_access_kind: SourceAccessKind;
  readonly source_access_ref: string;
  readonly members: readonly GovernedDataHandoffMember[];
}

export interface GovernedDataMaterializationProgram {
  readonly program_ref: typeof GOVERNED_DATA_MATERIAL_PROGRAM_REF;
  materialize_governed_data(input: Readonly<{
    data_category: GovernedDataCategory;
    authorized_exposure_request: StaticJsonObject;
    exact_source_authority: StaticJsonObject;
    owning_persistence_contract: StaticJsonObject;
    integrity_profile: StaticJsonObject;
    artifact_store_binding: StaticJsonObject;
  }>): Promise<StaticJsonObject>;
}

export interface GovernedDataProviderRealizationInput {
  readonly capability_contract_ref: string;
  readonly capability_contract_hash: string;
  readonly governed_data_exposure_mode: "DECLARED";
  readonly handoff_binding: GovernedDataHandoffBinding;
  readonly p2_operation_input: StaticJsonObject;
  readonly runtime_context: StaticJsonObject;
  readonly trace_id: string;
  readonly request_id: string;
  readonly p1_interface_anchor_binding_ref?: string;
}

export interface GovernedDataProviderRealizationResult {
  readonly repository_support_ref: typeof REPOSITORY_SKELETON_REF;
  readonly p1_capability_materialization_ref: typeof P1_CAPABILITY_MATERIALIZATION_REF;
  readonly p1_business_runtime_ref: typeof P1_BUSINESS_RUNTIME_REF;
  readonly p2_contract_ref: typeof P2_CONTRACT_REF;
  readonly governed_data_material_program_ref: typeof GOVERNED_DATA_MATERIAL_PROGRAM_REF;
  readonly handoff_binding_ref: string;
  readonly data_category: GovernedDataCategory;
  readonly p2_operation_id: "expose_static_data" | "expose_dynamic_data" | "expose_runtime_data";
  readonly p2_runtime_result: StaticJsonObject;
}

export class GovernedDataProviderRealizationError extends StableRuntimeError {
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(code, message, details);
    this.name = "GovernedDataProviderRealizationError";
  }
}

const CATEGORY_ACCESS: Readonly<Record<GovernedDataCategory, readonly SourceAccessKind[]>> =
  Object.freeze({
    STATIC: Object.freeze(["P1_AUTHORIZED_STATIC_OR_PACKAGE_FACT"]),
    DYNAMIC: Object.freeze([
      "DECLARED_Q_INTERFACE_SOURCE_FACT",
      "AUTHORIZED_GOVERNED_STATE_OR_REGISTRY_FACT",
    ]),
    RUNTIME: Object.freeze(["ALREADY_PRODUCED_RUNTIME_FACT"]),
  });

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_BINDING_INVALID",
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function exactHash(value: unknown, field: string): string {
  const text = requiredString(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_BINDING_INVALID",
      `${field} must be an exact sha256 binding`,
    );
  }
  return text;
}

function exactCategory(value: unknown): GovernedDataCategory {
  if (value !== "STATIC" && value !== "DYNAMIC" && value !== "RUNTIME") {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_CATEGORY_INVALID",
      "data_category must be explicitly STATIC, DYNAMIC, or RUNTIME",
    );
  }
  return value;
}

function validateHandoff(
  binding: Readonly<GovernedDataHandoffBinding>,
  interfaceAnchorBindingRef: string | undefined,
): GovernedDataHandoffBinding {
  const category = exactCategory(binding.data_category);
  const sourceAccessKind = binding.source_access_kind;
  if (!(CATEGORY_ACCESS[category] as readonly string[]).includes(sourceAccessKind)) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_SOURCE_ACCESS_INVALID",
      "source_access_kind is not allowed for the explicit data_category",
    );
  }

  requiredString(binding.binding_ref, "handoff_binding.binding_ref");
  requiredString(binding.source_access_ref, "handoff_binding.source_access_ref");
  if (!Array.isArray(binding.members) || binding.members.length === 0) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_BINDING_INVALID",
      "handoff_binding.members must be non-empty",
    );
  }

  const memberRefs = new Set<string>();
  for (const member of binding.members) {
    const memberRef = requiredString(member.member_ref, "handoff_binding.members.member_ref");
    if (memberRefs.has(memberRef)) {
      throw new GovernedDataProviderRealizationError(
        "RDS_GOVERNED_DATA_BINDING_INVALID",
        "handoff_binding member_ref values must be unique",
      );
    }
    memberRefs.add(memberRef);
    requiredString(member.source_fact_ref, "handoff_binding.members.source_fact_ref");
    requiredString(
      member.source_fact_authority_ref,
      "handoff_binding.members.source_fact_authority_ref",
    );
  }

  if (sourceAccessKind === "DECLARED_Q_INTERFACE_SOURCE_FACT") {
    requiredString(interfaceAnchorBindingRef, "p1_interface_anchor_binding_ref");
  }

  return binding;
}


export async function realizeGovernedDataExposure(
  input: Readonly<GovernedDataProviderRealizationInput>,
  materialization: GovernedDataMaterializationProgram,
): Promise<GovernedDataProviderRealizationResult> {
  if (input.governed_data_exposure_mode !== "DECLARED") {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_NOT_DECLARED",
      "repository support may execute governed-data exposure only for an exact DECLARED handoff",
    );
  }

  requiredString(input.capability_contract_ref, "capability_contract_ref");
  exactHash(input.capability_contract_hash, "capability_contract_hash");
  requiredString(input.trace_id, "trace_id");
  requiredString(input.request_id, "request_id");

  const handoff = validateHandoff(
    input.handoff_binding,
    input.p1_interface_anchor_binding_ref,
  );
  const category = exactCategory(handoff.data_category);

  if (materialization.program_ref !== GOVERNED_DATA_MATERIAL_PROGRAM_REF) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_MATERIALIZER_INVALID",
      "materialize_governed_data must bind the exact CURRENT governed_data_materialize_v1 program",
    );
  }

  if (
    category === "RUNTIME"
    && (input.p2_operation_input as Readonly<Record<string, unknown>>).reexecution_requested === true
  ) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_RUNTIME_REEXECUTION_FORBIDDEN",
      "RUNTIME exposure may use only already-produced runtime facts",
    );
  }

  const request = {
    input: input.p2_operation_input,
    runtime_context: input.runtime_context,
    trace_id: input.trace_id,
    request_id: input.request_id,
  };
  const dependencies = {
    materialize_governed_data: (materializationInput: Parameters<
      GovernedDataMaterializationProgram["materialize_governed_data"]
    >[0]) => materialization.materialize_governed_data(materializationInput),
  };

  let p2OperationId:
    | "expose_static_data"
    | "expose_dynamic_data"
    | "expose_runtime_data";
  let response: Awaited<ReturnType<typeof exposeStaticData>>;

  switch (category) {
    case "STATIC":
      p2OperationId = "expose_static_data";
      response = await exposeStaticData(request, dependencies);
      break;
    case "DYNAMIC":
      p2OperationId = "expose_dynamic_data";
      response = await exposeDynamicData(request, dependencies);
      break;
    case "RUNTIME":
      p2OperationId = "expose_runtime_data";
      response = await exposeRuntimeData(request, dependencies);
      break;
  }

  const resultCategory = (response.runtime_result as Readonly<Record<string, unknown>>).data_category;
  if (resultCategory !== category) {
    throw new GovernedDataProviderRealizationError(
      "RDS_GOVERNED_DATA_P2_RESULT_MISMATCH",
      "P2 governed-data result category does not match the exact handoff binding",
    );
  }

  return deep_freeze({
    repository_support_ref: REPOSITORY_SKELETON_REF,
    p1_capability_materialization_ref: P1_CAPABILITY_MATERIALIZATION_REF,
    p1_business_runtime_ref: P1_BUSINESS_RUNTIME_REF,
    p2_contract_ref: P2_CONTRACT_REF,
    governed_data_material_program_ref: GOVERNED_DATA_MATERIAL_PROGRAM_REF,
    handoff_binding_ref: handoff.binding_ref,
    data_category: category,
    p2_operation_id: p2OperationId,
    p2_runtime_result: response.runtime_result,
  });
}
