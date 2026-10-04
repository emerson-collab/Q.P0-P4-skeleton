import test from "node:test";
import assert from "node:assert/strict";
import { handler, OPERATION_ID } from "../../../../src/p3/governed_evolution/rollback_candidate/handler.ts";
import { response, type P3Call } from "../../../../src/p3/governed_evolution/stage_extension_contract.ts";
import type { P3EvolutionRuntime } from "../../../../src/p3/governed_evolution/evolution_runtime_binding.ts";

test("rollback_candidate leaf binds exactly one declared handler", async()=>{
 const call={route_key:"p3.rollback_candidate",operation_id:OPERATION_ID,trace_id:"t",request_id:"r",operation_contract:"Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145#/interface_contract/operations/rollback_candidate",policy_refs:[],receipt_contract_ref:"Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145#/persistence_and_receipts/receipt",input:{},context:{}} as P3Call;
 let invoked=0; const runtime={ rollbackCandidate: async(c:P3Call)=>{invoked++;return response(c,{bound_operation:"rollback_candidate"},null);} } as unknown as P3EvolutionRuntime;
 const result=await handler(call,runtime); assert.equal(result.outcome_type,"Response"); assert.equal(invoked,1); assert.equal(result.outcome_type==="Response"?result.runtime_result.bound_operation:null,"rollback_candidate");
});
