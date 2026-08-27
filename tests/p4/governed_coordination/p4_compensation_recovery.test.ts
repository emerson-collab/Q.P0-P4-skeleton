import test from "node:test";import assert from "node:assert/strict";import { reverseSuccessfulActivationOrder } from "../../../src/p4/governed_coordination/compensation_plan_resolver.ts";
test("compensation reverses successful activation order",()=>assert.deepEqual(reverseSuccessfulActivationOrder(["a","b","c"]),["c","b","a"]));
