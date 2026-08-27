import test from "node:test";import assert from "node:assert/strict";import { validateEvaluationDecision } from "../../../src/p3/governed_evolution/outcome_evaluation_handler.ts";
test("evaluation decision set is closed",()=>{for(const v of ["RETAIN","ADJUST","ROLLBACK","ESCALATE"])assert.equal(validateEvaluationDecision(v),v);assert.throws(()=>validateEvaluationDecision("PROMOTE"));});
