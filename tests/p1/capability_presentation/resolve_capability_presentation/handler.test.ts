import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { StableRuntimeError } from "../../../../src/p0/runtime_contract.ts";
import {
  OPERATION_REF,
  handler,
} from "../../../../src/p1/capability_presentation/resolve_capability_presentation/handler.ts";

const capabilityPresentationRef = "q.app.capability-presentation:example";

const input = {
  capability_presentation_ref: capabilityPresentationRef,
  design_requirements: {
    semantic_group_kinds: ["RESOURCE", "TASK"],
    navigation_intents: ["PRIMARY", "SECONDARY"],
    presentation_priority_levels: ["PRIMARY", "OVERFLOW"],
    design_constraints: {},
  },
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function contentHash(artifact: Record<string, unknown>): string {
  return `sha256:${createHash("sha256").update(canonicalize({
    capability_presentation_ref: artifact.capability_presentation_ref,
    context_scope: artifact.context_scope,
    semantic_group_kinds: artifact.semantic_group_kinds,
    navigation_intents: artifact.navigation_intents,
    presentation_priority_levels: artifact.presentation_priority_levels,
    design_constraints: artifact.design_constraints,
  }), "utf8").digest("hex")}`;
}

const artifactBase = {
  capability_presentation_ref: capabilityPresentationRef,
  context_scope: "STANDALONE_APPLICATION",
  semantic_group_kinds: ["RESOURCE", "TASK", "CONTEXT", "SYSTEM"],
  navigation_intents: ["PRIMARY", "SECONDARY", "NONE"],
  presentation_priority_levels: ["PRIMARY", "SECONDARY", "OVERFLOW", "BACKGROUND"],
  design_constraints: {},
};

const candidate = {
  capability_presentation_design_artifact: {
    ...artifactBase,
    content_hash: contentHash(artifactBase),
  },
};

function context(resolved: unknown, operationRef = OPERATION_REF) {
  return {
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}",
    operation_ref: operationRef,
    trace_id: "trace-1",
    request_id: "request-1",
    invocation_id: "invoke-1",
    binding_set_ref: "q.app.binding-set:test",
    attributes: { [OPERATION_REF]: resolved },
  } as const;
}

test("resolve_capability_presentation returns only exact schema-valid resolved material", () => {
  const result = handler(input, context(candidate));
  assert.deepEqual(result, candidate);
  assert.equal(Object.isFrozen(result), true);
});

test("resolve_capability_presentation fails closed when resolved material is absent", () => {
  assert.throws(
    () => handler(input, context(undefined)),
    (error: unknown) => error instanceof StableRuntimeError
      && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
  );
});

test("resolve_capability_presentation rejects undeclared input fields by request schema", () => {
  assert.throws(
    () => handler({ ...input, undeclared: true }, context(candidate)),
    (error: unknown) => error instanceof StableRuntimeError
      && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
  );
});

test("resolve_capability_presentation rejects a mismatched capability_presentation_ref", () => {
  const invalid = structuredClone(candidate);
  invalid.capability_presentation_design_artifact.capability_presentation_ref = "q.app.capability-presentation:other";
  assert.throws(
    () => handler(input, context(invalid)),
    (error: unknown) => error instanceof StableRuntimeError
      && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
  );
});

test("resolve_capability_presentation rejects a non-canonical content_hash", () => {
  const invalid = structuredClone(candidate);
  invalid.capability_presentation_design_artifact.content_hash = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => handler(input, context(invalid)),
    (error: unknown) => error instanceof StableRuntimeError
      && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_CONFLICT",
  );
});
