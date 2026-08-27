import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler } from "../../../../src/p1/build_instance_plan/resolve_binding_set/handler.ts";
test("resolve_binding_set prefers exact Contract facts and needs no caller binding payload",async()=>{ const r=await handler({input:{COMPILED_CONTRACT:{normalized_facts:{name:"Q"}},EXACT_PHYSICAL_MANIFEST:["a"],EXACT_TEMPLATE_SET:{a:{tokens:{name:{contract_path:"name"}}}}},runtime_context:ctx,trace_id:"t",request_id:"r"});assert.equal(((r.runtime_result.EXACT_BINDING_SET as Record<string,unknown>).values as Record<string,unknown>).name,"Q");});
