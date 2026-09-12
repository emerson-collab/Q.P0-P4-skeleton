import { createHash } from "node:crypto";
import { StableRuntimeError, deep_freeze } from "../../../p0/runtime_contract.ts";
import type { RuntimeContext } from "../../../p0/runtime_contract.ts";

export const CAPABILITY_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109" as const;
export const CAPABILITY_CONTRACT_HASH = "sha256:819518a183e82facc11c2d8832a27607dcff1d5a3bfd60d9c2d2e53187ec9873" as const;
export const OPERATION_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/operations/resolve_capability_presentation" as const;
export const INTERFACE_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/interfaces/capability_presentation_invoke" as const;
export const REQUEST_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/contracts/resolve_capability_presentation_request_contract" as const;
export const RESPONSE_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/contracts/resolve_capability_presentation_response_contract" as const;
export const STABLE_ERROR_CONTRACT_REF = "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0109#/stable_error_contract" as const;

const REQUEST_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "capability_presentation_ref": {
      "type": "string",
      "minLength": 1
    },
    "design_requirements": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "semantic_group_kinds": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "RESOURCE",
              "TASK",
              "CONTEXT",
              "SYSTEM"
            ]
          },
          "uniqueItems": true,
          "minItems": 1
        },
        "navigation_intents": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "PRIMARY",
              "SECONDARY",
              "NONE"
            ]
          },
          "uniqueItems": true,
          "minItems": 1
        },
        "presentation_priority_levels": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "PRIMARY",
              "SECONDARY",
              "OVERFLOW",
              "BACKGROUND"
            ]
          },
          "uniqueItems": true,
          "minItems": 1
        },
        "design_constraints": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "required": [
        "semantic_group_kinds",
        "navigation_intents",
        "presentation_priority_levels",
        "design_constraints"
      ]
    }
  },
  "required": [
    "capability_presentation_ref",
    "design_requirements"
  ]
} as const;

const RESPONSE_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "capability_presentation_design_artifact": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "capability_presentation_ref": {
          "type": "string",
          "minLength": 1
        },
        "context_scope": {
          "const": "STANDALONE_APPLICATION"
        },
        "semantic_group_kinds": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "RESOURCE",
              "TASK",
              "CONTEXT",
              "SYSTEM"
            ]
          },
          "uniqueItems": true
        },
        "navigation_intents": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "PRIMARY",
              "SECONDARY",
              "NONE"
            ]
          },
          "uniqueItems": true
        },
        "presentation_priority_levels": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "PRIMARY",
              "SECONDARY",
              "OVERFLOW",
              "BACKGROUND"
            ]
          },
          "uniqueItems": true
        },
        "design_constraints": {
          "type": "object",
          "additionalProperties": true
        },
        "content_hash": {
          "type": "string",
          "pattern": "^sha256:[0-9a-f]{64}$"
        }
      },
      "required": [
        "capability_presentation_ref",
        "context_scope",
        "semantic_group_kinds",
        "navigation_intents",
        "presentation_priority_levels",
        "design_constraints",
        "content_hash"
      ]
    }
  },
  "required": [
    "capability_presentation_design_artifact"
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
      if (key in value && isRecord(propertySchema) && !schemaMatches(value[key], propertySchema as JsonSchema)) return false;
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

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function sha256_hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertDesignInvariants(
  input: Record<string, unknown>,
  candidate: Record<string, unknown>,
): void {
  const artifact = candidate.capability_presentation_design_artifact as Record<string, unknown>;
  if (artifact.capability_presentation_ref !== input.capability_presentation_ref) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
      "Resolved design artifact does not preserve the exact capability_presentation_ref.",
    );
  }
  const requirements = input.design_requirements as Record<string, unknown>;
  const requirementGroups = requirements.semantic_group_kinds as readonly string[];
  const artifactGroups = artifact.semantic_group_kinds as readonly string[];
  if (!requirementGroups.every((kind) => artifactGroups.includes(kind))) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
      "Resolved semantic_group_kinds do not cover the declared design requirements.",
    );
  }
  const requirementNavigation = requirements.navigation_intents as readonly string[];
  const artifactNavigation = artifact.navigation_intents as readonly string[];
  if (!requirementNavigation.every((intent) => artifactNavigation.includes(intent))) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
      "Resolved navigation_intents do not cover the declared design requirements.",
    );
  }
  const requirementPriority = requirements.presentation_priority_levels as readonly string[];
  const artifactPriority = artifact.presentation_priority_levels as readonly string[];
  if (!requirementPriority.every((level) => artifactPriority.includes(level))) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
      "Resolved presentation_priority_levels do not cover the declared design requirements.",
    );
  }
  const expectedHash = `sha256:${sha256_hex(canonicalize({
    capability_presentation_ref: artifact.capability_presentation_ref,
    context_scope: artifact.context_scope,
    semantic_group_kinds: artifact.semantic_group_kinds,
    navigation_intents: artifact.navigation_intents,
    presentation_priority_levels: artifact.presentation_priority_levels,
    design_constraints: artifact.design_constraints,
  }))}`;
  if (artifact.content_hash !== expectedHash) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
      "Resolved design artifact content_hash does not match its canonical content.",
    );
  }
}

export function handler(input: unknown, runtimeContext: RuntimeContext): Readonly<Record<string, unknown>> {
  assertSchema(
    input,
    REQUEST_SCHEMA,
    "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
    "Input does not conform to the exact request Contract.",
  );
  if (runtimeContext.operation_ref !== OPERATION_REF) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
      "RuntimeContext is bound to a different Operation authority.",
    );
  }
  const candidate = runtimeContext.attributes?.[OPERATION_REF];
  if (candidate === undefined) {
    throw new StableRuntimeError(
      "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
      "No exact resolved material is bound to this Operation in runtime_context.",
    );
  }
  assertSchema(
    candidate,
    RESPONSE_SCHEMA,
    "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
    "Resolved material does not conform to the exact response Contract.",
  );
  assertDesignInvariants(input, candidate);
  return deep_freeze(candidate);
}
