import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler, LOCAL_DEPENDENCY_REF, P1_DEPENDENCY_INVOKE_INTERFACE_REF } from "../../../../src/p1/domain_instantiation/materialize_repository/handler.ts";
test("materialize_repository uses only declared dependency_invoke",async()=>{ const r=await handler({input:{EXACT_INSTANCE_PLAN:{files:{"a.ts":{sha256:`sha256:${"b".repeat(64)}`}}}},runtime_context:ctx,trace_id:"t",request_id:"r"},async(framework,local,_req)=>{assert.equal(framework,P1_DEPENDENCY_INVOKE_INTERFACE_REF);assert.equal(local,LOCAL_DEPENDENCY_REF);return{outcome_type:"response",runtime_result:{MATERIALIZED_REPOSITORY:{resulting_repository_revision:"rev1"}},trace_id:"t",request_id:"r"};}); assert.equal((r.runtime_result.MATERIALIZED_REPOSITORY as Record<string,unknown>).resulting_repository_revision,"rev1");});
