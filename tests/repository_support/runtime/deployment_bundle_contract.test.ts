import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDeploymentBundleCoverage,
  deploymentBundleIncludePatterns,
} from "../../../runtime/deployment_bundle_contract.ts";

test("deployment bundle requires src runtime and P1 spec roots", () => {
  assert.deepEqual(
    deploymentBundleIncludePatterns("../"),
    ["../src/**", "../runtime/**", "../spec/p1/**"],
  );
  assert.doesNotThrow(() => assertDeploymentBundleCoverage(
    ["../src/**", "../runtime/**", "../spec/p1/**"],
    "../",
  ));
});

test("deployment bundle fails closed when fixed runtime root is omitted", () => {
  assert.throws(
    () => assertDeploymentBundleCoverage(["../src/**", "../spec/p1/**"], "../"),
    /deployment bundle is missing fixed repository runtime paths/,
  );
});
