import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { StableRuntimeError } from "../../../../src/p0/runtime_contract.ts";
import {
  OPERATION_REF,
  handler,
} from "../../../../src/p1/application_presentation/resolve_application_presentation/handler.ts";

const designRef = "q.app.capability-presentation-design:example";

const applicationDesignRequirements = {
  workspace_design: {},
  navigation_design: {},
  composition_design: {},
  interaction_composition_design: {},
  target_independent_accessibility_requirements: {},
};

const input = {
  application_presentation_ref: "q.app.application-presentation:example",
  application_design_requirements: applicationDesignRequirements,
  capability_presentation_designs: [{
    capability_presentation_design_ref: designRef,
  }],
};

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

function buildContext(overrides: Record<string, unknown> = {}) {
  const hashable = {
    presentation_context_ref: "q.app.application-presentation-context:example",
    presentation_context_kind: "APPLICATION",
    application_design_requirements: applicationDesignRequirements,
    capability_presentation_design_refs: [designRef],
    surface_requirements: {},
    ...overrides,
  };
  return {
    application_presentation_context: {
      ...hashable,
      content_hash: sha256_canonical_json(hashable),
    },
  };
}

function context(resolved: unknown, operationRef = OPERATION_REF) {
  return {
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0179",
    operation_ref: operationRef,
    trace_id: "trace-1",
    request_id: "request-1",
    invocation_id: "invoke-1",
    binding_set_ref: "q.app.binding-set:test",
    attributes: { [OPERATION_REF]: resolved },
  } as const;
}

test("resolve_application_presentation returns only exact schema-valid resolved material", () => {
  const candidate = buildContext();
  const result = handler(input, context(candidate));
  assert.deepEqual(result, candidate);
  assert.equal(Object.isFrozen(result), true);
});

test("resolve_application_presentation fails closed without resolved material", () => {
  assert.throws(
    () => handler(input, context(undefined)),
    (error: unknown) => error instanceof StableRuntimeError && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
  );
});

test("resolve_application_presentation rejects undeclared request fields", () => {
  assert.throws(
    () => handler({ ...input, undeclared: true }, context(buildContext())),
    (error: unknown) => error instanceof StableRuntimeError && error.code === "APP_APPLICATION_PRESENTATION_DESIGN_REQUIREMENTS_INVALID",
  );
});

test("resolve_application_presentation rejects design reference mismatch", () => {
  const candidate = buildContext({
    capability_presentation_design_refs: ["q.app.capability-presentation-design:other"],
  });
  assert.throws(
    () => handler(input, context(candidate)),
    (error: unknown) => error instanceof StableRuntimeError && error.code === "APP_CAPABILITY_PRESENTATION_DESIGN_UNRESOLVED",
  );
});

test("resolve_application_presentation rejects a mismatched content hash", () => {
  const candidate = buildContext();
  (candidate.application_presentation_context as Record<string, unknown>).content_hash = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => handler(input, context(candidate)),
    (error: unknown) => error instanceof StableRuntimeError && error.code === "APP_APPLICATION_PRESENTATION_DESIGN_CONFLICT",
  );
});
