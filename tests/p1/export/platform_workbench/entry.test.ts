import assert from "node:assert/strict";
import test from "node:test";
import { entry } from "../../../../src/p1/export/platform_workbench/entry";

test("entry is static exact surface-derived extraction authority", () => {
  assert.equal(entry.capability_ref, "Q.PLATFORM.CAPABILITY.PLATFORM_WORKBENCH@V0106");
  assert.deepEqual(entry.public_operation_refs, ["Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/operations/render_platform_workbench"]);
  assert.deepEqual(entry.public_interface_refs, ["Q.PLATFORM.CONTRACT.CAPABILITY.PLATFORM_WORKBENCH@V0106#/interfaces/platform_workbench_invoke"]);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, "invoke"), false);
  assert.equal(Object.isFrozen(entry), true);
});
