import assert from "node:assert/strict";
import test from "node:test";
import { render_platform_workbench } from "../../../../src/p1/platform_workbench/render_platform_workbench/handler";

function request() {
  return {
    platform_presentation_ref: "platform-presentation:default",
    platform_design_requirements: {
      workspace_design: { layout: "grid", zones: ["primary", "secondary"] },
      domain_aggregation_design: { grouping: "domain" },
      navigation_design: { mode: "workspace" },
      arrangement_design: { mode: "arrange" },
      dock_design: { placement: "bottom" },
      responsive_composition_requirements: { breakpoints: [640, 1024] },
    },
  };
}

test("materializes deterministic renderer-neutral response without mutating caller input", () => {
  const input = request();
  const result = render_platform_workbench(input);
  assert.equal(result.kind, "response");
  if (result.kind !== "response") return;
  const context = result.response.platform_presentation_context;
  assert.equal(context.presentation_context_kind, "PLATFORM");
  assert.equal(context.presentation_context_ref, input.platform_presentation_ref);
  assert.match(context.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(context.surface_requirements, {});
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.platform_design_requirements.workspace_design), false);
  assert.equal(Object.isFrozen(context), true);
  const before = context.content_hash;
  input.platform_design_requirements.workspace_design.layout = "changed";
  assert.equal(context.workspace_design.layout, "grid");
  assert.equal(context.content_hash, before);
  const second = render_platform_workbench(request());
  assert.equal(second.kind, "response");
  if (second.kind === "response") assert.equal(second.response.platform_presentation_context.content_hash, before);
});

test("rejects undeclared top-level and design fields", () => {
  const top = { ...request(), extra: true };
  const topResult = render_platform_workbench(top);
  assert.equal(topResult.kind, "stable_error");
  if (topResult.kind === "stable_error") assert.equal(topResult.stable_error.error_code, "PLATFORM_UNDECLARED_PRESENTATION_FIELD");
  const nested = request() as ReturnType<typeof request> & { platform_design_requirements: ReturnType<typeof request>["platform_design_requirements"] & { extra?: object } };
  nested.platform_design_requirements.extra = {};
  const nestedResult = render_platform_workbench(nested);
  assert.equal(nestedResult.kind, "stable_error");
  if (nestedResult.kind === "stable_error") assert.equal(nestedResult.stable_error.error_code, "PLATFORM_UNDECLARED_PRESENTATION_FIELD");
});

test("rejects incomplete or non-JSON-safe design material fail-closed", () => {
  const missing = request() as any;
  delete missing.platform_design_requirements.dock_design;
  const missingResult = render_platform_workbench(missing);
  assert.equal(missingResult.kind, "stable_error");
  if (missingResult.kind === "stable_error") assert.equal(missingResult.stable_error.error_code, "PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID");

  const cyclic = request() as any;
  cyclic.platform_design_requirements.workspace_design.self = cyclic.platform_design_requirements.workspace_design;
  assert.equal(render_platform_workbench(cyclic).kind, "stable_error");

  const nonFinite = request() as any;
  nonFinite.platform_design_requirements.workspace_design.ratio = Number.NaN;
  assert.equal(render_platform_workbench(nonFinite).kind, "stable_error");

  const sparse = request() as any;
  const array = new Array(2);
  array[1] = "x";
  sparse.platform_design_requirements.workspace_design.zones = array;
  assert.equal(render_platform_workbench(sparse).kind, "stable_error");

  let getterCalls = 0;
  const accessor = request() as any;
  Object.defineProperty(accessor.platform_design_requirements.workspace_design, "computed", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "x";
    },
  });
  assert.equal(render_platform_workbench(accessor).kind, "stable_error");
  assert.equal(getterCalls, 0);

  const symbolValue = request() as any;
  symbolValue.platform_design_requirements.workspace_design[Symbol("x")] = "x";
  assert.equal(render_platform_workbench(symbolValue).kind, "stable_error");
});
