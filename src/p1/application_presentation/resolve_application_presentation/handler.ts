import { createHash } from "node:crypto";
import { StableRuntimeError, deep_freeze } from "../../../p0/runtime_contract.ts";
import type { RuntimeContext } from "../../../p0/runtime_contract.ts";

export const CAPABILITY_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109" as const;
export const OPERATION_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109#/operations/resolve_application_presentation" as const;
export const INTERFACE_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109#/interfaces/application_presentation_invoke" as const;
export const REQUEST_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109#/contracts/resolve_application_presentation_request_contract" as const;
export const RESPONSE_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109#/contracts/resolve_application_presentation_response_contract" as const;
export const STABLE_ERROR_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0109#/stable_error_contract" as const;
export const CAPABILITY_PRESENTATION_DESIGN_ARTIFACT_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/type_closure/schemas/capability_presentation_design_artifact" as const;

const REQUEST_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "application_presentation_ref": {
      "type": "string",
      "minLength": 1
    },
    "application_design_requirements": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "workspace_design": {
          "type": "object",
          "additionalProperties": true
        },
        "navigation_design": {
          "type": "object",
          "additionalProperties": true
        },
        "composition_design": {
          "type": "object",
          "additionalProperties": true
        },
        "interaction_composition_design": {
          "type": "object",
          "additionalProperties": true
        },
        "target_independent_accessibility_requirements": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "required": [
        "workspace_design",
        "navigation_design",
        "composition_design",
        "interaction_composition_design",
        "target_independent_accessibility_requirements"
      ]
    },
    "capability_presentation_designs": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": true
      }
    }
  },
  "required": [
    "application_presentation_ref",
    "application_design_requirements",
    "capability_presentation_designs"
  ]
} as const;

const RESPONSE_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "application_presentation_context": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "presentation_context_ref": {
          "type": "string",
          "minLength": 1
        },
        "presentation_context_kind": {
          "const": "APPLICATION"
        },
        "application_design_requirements": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "workspace_design": {
              "type": "object",
              "additionalProperties": true
            },
            "navigation_design": {
              "type": "object",
              "additionalProperties": true
            },
            "composition_design": {
              "type": "object",
              "additionalProperties": true
            },
            "interaction_composition_design": {
              "type": "object",
              "additionalProperties": true
            },
            "target_independent_accessibility_requirements": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": [
            "workspace_design",
            "navigation_design",
            "composition_design",
            "interaction_composition_design",
            "target_independent_accessibility_requirements"
          ]
        },
        "capability_presentation_design_refs": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "surface_requirements": {
          "type": "object",
          "additionalProperties": true
        },
        "content_hash": {
          "type": "string",
          "pattern": "^sha256:[0-9a-f]{64}$"
        }
      },
      "required": [
        "presentation_context_ref",
        "presentation_context_kind",
        "application_design_requirements",
        "capability_presentation_design_refs",
        "surface_requirements",
        "content_hash"
      ]
    }
  },
  "required": [
    "application_presentation_context"
  ]
} as const;

type JsonSchema = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
  }
  return false;
}

function schemaMatches(value: unknown, schema: JsonSchema): boolean {
  const declaredType = schema.type;
  if (Array.isArray(declaredType)) {
    if (!declaredType.some((kind) => schemaMatches(value, { ...schema, type: kind }))) return false;
  } else if (declaredType === "object") {
    if (!isRecord(value)) return false;
  } else if (declaredType === "array") {
    if (!Array.isArray(value)) return false;
  } else if (declaredType === "string") {
    if (typeof value !== "string") return false;
  } else if (declaredType === "null") {
    if (value !== null) return false;
  } else if (declaredType === "boolean") {
    if (typeof value !== "boolean") return false;
  } else if (declaredType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
  } else if (declaredType === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) return false;
  }

  if ("const" in schema && !deepEqual(value, schema.const)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) return false;

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) return false;
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) return false;
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
    if (schema.uniqueItems === true) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(index + 1).some((candidate) => deepEqual(value[index], candidate))) return false;
      }
    }
    if (isRecord(schema.items) && !value.every((item) => schemaMatches(item, schema.items as JsonSchema))) return false;
  }

  if (isRecord(value)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
    if (!required.every((key) => key in value)) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !(key in properties))) return false;
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value && isRecord(propertySchema) && !schemaMatches(value[key], propertySchema)) return false;
    }
  }

  if (Array.isArray(schema.allOf) && !schema.allOf.every((part) => !isRecord(part) || schemaMatches(value, part))) return false;
  if (isRecord(schema.if) && schemaMatches(value, schema.if)) {
    if (isRecord(schema.then) && !schemaMatches(value, schema.then)) return false;
  }
  if (isRecord(schema.not) && schemaMatches(value, schema.not)) return false;

  return true;
}

function assertSchema(
  value: unknown,
  schema: JsonSchema,
  code: string,
  message: string,
): asserts value is Record<string, unknown> {
  if (!schemaMatches(value, schema)) throw new StableRuntimeError(code, message);
}

function canonical_json(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonical_json(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical_json(record[key])}`).join(",")}}`;
}

function sha256_canonical_json(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical_json(value), "utf8").digest("hex")}`;
}

function assertContractInvariants(
  input: Record<string, unknown>,
  candidate: Record<string, unknown>,
): void {
  const context = candidate.application_presentation_context as Record<string, unknown>;
  if (context.presentation_context_kind !== "APPLICATION") {
    throw new StableRuntimeError(
      "APP_APPLICATION_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
      "The resolved presentation context kind must be APPLICATION.",
    );
  }
  if (!deepEqual(context.application_design_requirements, input.application_design_requirements)) {
    throw new StableRuntimeError(
      "APP_APPLICATION_PRESENTATION_DESIGN_CONFLICT",
      "The resolved presentation context must preserve the exact application design requirements.",
    );
  }
  const designRefs = context.capability_presentation_design_refs as unknown[];
  if (designRefs.length === 0 || new Set(designRefs).size !== designRefs.length) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
      "Capability presentation design references must be non-empty and unique.",
    );
  }
  const designs = input.capability_presentation_designs as Record<string, unknown>[];
  const declaredRefs = designs
    .map((design) => design.capability_presentation_design_ref)
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  if (declaredRefs.length !== designs.length) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
      "Every capability presentation design must declare an exact capability_presentation_design_ref.",
    );
  }
  if (new Set(declaredRefs).size !== declaredRefs.length) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
      "Capability presentation design references must be unique.",
    );
  }
  if (
    declaredRefs.length !== designRefs.length
    || !declaredRefs.every((ref) => designRefs.includes(ref))
  ) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
      "Resolved capability presentation design references must match the exact declared designs.",
    );
  }
  const { content_hash: contentHash, ...hashable } = context;
  if (contentHash !== sha256_canonical_json(hashable)) {
    throw new StableRuntimeError(
      "APP_APPLICATION_PRESENTATION_DESIGN_CONFLICT",
      "The presentation context content hash does not match its canonical content.",
    );
  }
}

export function handler(input: unknown, runtimeContext: RuntimeContext): Readonly<Record<string, unknown>> {
  assertSchema(
    input,
    REQUEST_SCHEMA,
    "APP_APPLICATION_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
    "Input does not conform to the exact request Contract.",
  );
  if (runtimeContext.operation_ref !== OPERATION_REF) {
    throw new StableRuntimeError(
      "APP_APPLICATION_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
      "RuntimeContext is bound to a different Operation authority.",
    );
  }
  const candidate = runtimeContext.attributes?.[OPERATION_REF];
  if (candidate === undefined) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
      "No exact resolved material is bound to this Operation in runtime_context.",
    );
  }
  assertSchema(
    candidate,
    RESPONSE_SCHEMA,
    "APP_APPLICATION_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
    "Resolved material does not conform to the exact response Contract.",
  );
  assertContractInvariants(input, candidate);
  return deep_freeze(candidate);
}
