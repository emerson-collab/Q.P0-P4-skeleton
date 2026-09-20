import {
  StableRuntimeError,
  deep_freeze,
  exact_ref,
} from "../src/p0/runtime_contract.ts";
import type { RuntimeOperation } from "../src/p0/runtime_contract.ts";
import {
  register_business_event_interface,
  register_business_operation,
  type BusinessEventInterfaceBinding,
  type BusinessEventInterfaceKind,
} from "../src/p1/business_runtime/business_operation_registry.ts";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export type P1RuntimeVariableSourceKind = "CONTRACT_GENERAL_FACT";

export interface P1CapabilityCodeVariableSource {
  readonly exact_source_capability_contract_ref: string;
  readonly exact_source_capability_contract_hash: string;
  readonly general_facts: Readonly<Record<string, unknown>>;
}

export interface P1RuntimeTokenDeclaration {
  readonly token_ref: string;
  readonly variable_id: string;
  readonly source_kind: P1RuntimeVariableSourceKind;
  readonly source_fact_key: string;
}

export interface P1ResolvedRuntimeTokenBinding {
  readonly token_ref: string;
  readonly variable_id: string;
  readonly variable_source_kind: P1RuntimeVariableSourceKind;
  readonly exact_source_capability_contract_ref: string;
  readonly exact_source_capability_contract_hash: string;
  readonly exact_source_fact_key: string;
  readonly value: unknown;
}

export interface P1CapabilityEventRuntimeConnection {
  readonly exact_source_capability_contract_ref: string;
  readonly exact_source_capability_contract_hash: string;
  readonly capability_id: string;
  readonly event_interface_binding: BusinessEventInterfaceBinding;
  readonly token_bindings: readonly P1ResolvedRuntimeTokenBinding[];
}

export const P1_EVENT_RUNTIME_TOKEN_DECLARATIONS = deep_freeze([
  {
    token_ref: "runtime:p1:event:capability_contract_ref",
    variable_id: "capability_contract_ref",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "capability_contract_ref",
  },
  {
    token_ref: "runtime:p1:event:capability_id",
    variable_id: "capability_id",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "capability_id",
  },
  {
    token_ref: "runtime:p1:event:operation_ref",
    variable_id: "operation_ref",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "operation_ref",
  },
  {
    token_ref: "runtime:p1:event:interface_ref",
    variable_id: "event_interface_ref",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "event_interface_ref",
  },
  {
    token_ref: "runtime:p1:event:kind",
    variable_id: "event_interface_kind",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "event_interface_kind",
  },
  {
    token_ref: "runtime:p1:event:method_ref",
    variable_id: "event_method_ref",
    source_kind: "CONTRACT_GENERAL_FACT",
    source_fact_key: "event_method_ref",
  },
] satisfies readonly P1RuntimeTokenDeclaration[]);

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function exactCapabilityContractRef(value: unknown): string {
  const ref = nonEmptyString(value, "exact_source_capability_contract_ref");
  if (!exact_ref(ref) || ref.includes("#/")) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "exact_source_capability_contract_ref must be one exact versioned Capability Contract ref",
    );
  }
  return ref;
}

function exactCapabilityMember(
  capabilityContractRef: string,
  memberRef: unknown,
  memberKind: "operations" | "interfaces",
  field: string,
): string {
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/${memberKind}/`)) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      `${field} must be an exact ${memberKind} member of exact_source_capability_contract_ref`,
    );
  }
  return exact;
}

function immutableValue(value: unknown): unknown {
  if (Array.isArray(value)) return deep_freeze(value.map(immutableValue));
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(source)) clone[key] = immutableValue(source[key]);
    return deep_freeze(clone);
  }
  return value;
}

/**
 * Resolves predeclared repository/runtime tokens only from explicit GENERAL facts
 * exported by one exact P1 Capability code projection.
 *
 * The code projection is not semantic authority: exact Contract ref/hash lineage is
 * required on every binding. Missing, duplicate, ambiguous, inferred or defaulted
 * values fail closed.
 */
export function resolve_p1_capability_code_variables(
  source: Readonly<P1CapabilityCodeVariableSource>,
  declarations: readonly P1RuntimeTokenDeclaration[],
): readonly P1ResolvedRuntimeTokenBinding[] {
  const contractRef = exactCapabilityContractRef(source.exact_source_capability_contract_ref);
  const contractHash = nonEmptyString(
    source.exact_source_capability_contract_hash,
    "exact_source_capability_contract_hash",
  );
  if (!SHA256_PATTERN.test(contractHash)) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "exact_source_capability_contract_hash must be an exact sha256 binding",
    );
  }
  if (
    source.general_facts === null
    || typeof source.general_facts !== "object"
    || Array.isArray(source.general_facts)
  ) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "general_facts must be one explicit object projection",
    );
  }

  const seenTokenRefs = new Set<string>();
  const seenVariableIds = new Set<string>();
  const bindings: P1ResolvedRuntimeTokenBinding[] = [];

  for (const declaration of declarations) {
    const tokenRef = nonEmptyString(declaration.token_ref, "token_ref");
    const variableId = nonEmptyString(declaration.variable_id, "variable_id");
    const sourceFactKey = nonEmptyString(declaration.source_fact_key, "source_fact_key");

    if (declaration.source_kind !== "CONTRACT_GENERAL_FACT") {
      throw new StableRuntimeError(
        "P1_DYNAMIC_VARIABLE_SOURCE_KIND_UNSUPPORTED",
        "this binder accepts only exact Capability Contract GENERAL fact projections",
      );
    }
    if (seenTokenRefs.has(tokenRef) || seenVariableIds.has(variableId)) {
      throw new StableRuntimeError(
        "P1_DYNAMIC_VARIABLE_BINDING_AMBIGUOUS",
        "duplicate target token_ref or variable_id is forbidden",
      );
    }
    seenTokenRefs.add(tokenRef);
    seenVariableIds.add(variableId);

    if (!Object.prototype.hasOwnProperty.call(source.general_facts, sourceFactKey)) {
      throw new StableRuntimeError(
        "P1_DYNAMIC_VARIABLE_BINDING_UNRESOLVED",
        `required GENERAL fact is unresolved: ${sourceFactKey}`,
      );
    }
    const value = source.general_facts[sourceFactKey];
    if (value === undefined) {
      throw new StableRuntimeError(
        "P1_DYNAMIC_VARIABLE_BINDING_UNRESOLVED",
        `required GENERAL fact is undefined: ${sourceFactKey}`,
      );
    }

    bindings.push(deep_freeze({
      token_ref: tokenRef,
      variable_id: variableId,
      variable_source_kind: "CONTRACT_GENERAL_FACT",
      exact_source_capability_contract_ref: contractRef,
      exact_source_capability_contract_hash: contractHash,
      exact_source_fact_key: sourceFactKey,
      value: immutableValue(value),
    } satisfies P1ResolvedRuntimeTokenBinding));
  }

  return deep_freeze(bindings);
}

function valueByVariableId(
  bindings: readonly P1ResolvedRuntimeTokenBinding[],
  variableId: string,
): unknown {
  const matches = bindings.filter((binding) => binding.variable_id === variableId);
  if (matches.length !== 1) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_AMBIGUOUS",
      `variable_id must resolve exactly once: ${variableId}`,
    );
  }
  return matches[0]?.value;
}

function eventKind(value: unknown): BusinessEventInterfaceKind {
  if (value !== "EVENT_PUBLISH" && value !== "EVENT_CONSUME") {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "event_interface_kind must be EVENT_PUBLISH or EVENT_CONSUME",
    );
  }
  return value;
}

function eventMethod(
  kind: BusinessEventInterfaceKind,
  value: unknown,
): BusinessEventInterfaceBinding["method_ref"] {
  const method = nonEmptyString(value, "event_method_ref");
  const expected = kind === "EVENT_PUBLISH"
    ? "publish_business_event"
    : "consume_business_event";
  if (method !== expected) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "event_method_ref does not match event_interface_kind",
    );
  }
  return expected;
}

/**
 * Connects one P1 Capability code projection to the fixed P1 EVENT skeleton.
 *
 * Business code supplies only exact Contract GENERAL variables plus the existing
 * Operation handler. The Skeleton owns token validation and Interface -> Operation
 * registration. No Capability Instance, listener Operation, second Runtime, or
 * transport-selected Operation is introduced.
 */
export function connect_p1_capability_event_runtime(
  source: Readonly<P1CapabilityCodeVariableSource>,
  handler: RuntimeOperation<unknown, unknown>,
): P1CapabilityEventRuntimeConnection {
  const bindings = resolve_p1_capability_code_variables(
    source,
    P1_EVENT_RUNTIME_TOKEN_DECLARATIONS,
  );
  const contractRef = exactCapabilityContractRef(source.exact_source_capability_contract_ref);
  const projectedContractRef = nonEmptyString(
    valueByVariableId(bindings, "capability_contract_ref"),
    "capability_contract_ref",
  );
  if (projectedContractRef !== contractRef) {
    throw new StableRuntimeError(
      "P1_DYNAMIC_VARIABLE_BINDING_INVALID",
      "projected capability_contract_ref must equal exact source Capability Contract ref",
    );
  }

  const capabilityId = nonEmptyString(
    valueByVariableId(bindings, "capability_id"),
    "capability_id",
  );
  const operationRef = exactCapabilityMember(
    contractRef,
    valueByVariableId(bindings, "operation_ref"),
    "operations",
    "operation_ref",
  );
  const interfaceRef = exactCapabilityMember(
    contractRef,
    valueByVariableId(bindings, "event_interface_ref"),
    "interfaces",
    "event_interface_ref",
  );
  const kind = eventKind(valueByVariableId(bindings, "event_interface_kind"));
  const methodRef = eventMethod(
    kind,
    valueByVariableId(bindings, "event_method_ref"),
  );

  register_business_operation(operationRef, handler);
  const eventInterfaceBinding = register_business_event_interface({
    capability_contract_ref: contractRef,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT",
    kind,
    method_ref: methodRef,
  });

  return deep_freeze({
    exact_source_capability_contract_ref: contractRef,
    exact_source_capability_contract_hash: source.exact_source_capability_contract_hash,
    capability_id: capabilityId,
    event_interface_binding: eventInterfaceBinding,
    token_bindings: bindings,
  } satisfies P1CapabilityEventRuntimeConnection);
}
