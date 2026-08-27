import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler, LOCAL_DEPENDENCY_REF } from "../../../../src/p1/build_instance_plan/resolve_authority_snapshot/handler.ts";
test("resolve_authority_snapshot obtains exact selected-state material via declared dependency",async()=>{ let local=""; const r=await handler({input:{COMPILED_CONTRACT:{}},runtime_context:ctx,trace_id:"t",request_id:"r"},async(_f,l,_r)=>{local=l;return{outcome_type:"response",runtime_result:{EXACT_AUTHORITY_SNAPSHOT:{p1_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",p1_contract_hash:`sha256:${"e".repeat(64)}`}},trace_id:"t",request_id:"r"};}); assert.equal(local,LOCAL_DEPENDENCY_REF);assert.ok("EXACT_AUTHORITY_SNAPSHOT" in r.runtime_result);});
