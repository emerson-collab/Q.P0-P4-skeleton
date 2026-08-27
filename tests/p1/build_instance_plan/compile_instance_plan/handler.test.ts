import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler, sha256_text } from "../../../../src/p1/build_instance_plan/compile_instance_plan/handler.ts";
test("compile_instance_plan closes files and replay identity on V0106",async()=>{ const content="x";const tcontent="x";const input={COMPILED_CONTRACT:{source_contract_ref:"X@V0001",source_contract_hash:`sha256:${"f".repeat(64)}`},EXACT_AUTHORITY_SNAPSHOT:{},EXACT_PHYSICAL_MANIFEST:["a.ts"],EXACT_TEMPLATE_SET:{"a.ts":{template_ref:"T@V0001",template_hash:sha256_text(tcontent),content:tcontent}},EXACT_BINDING_SET:{values:{},binding_hash:sha256_text("{}")},EXACT_RENDERED_FILE_SET:{"a.ts":content}};const a=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});const b=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});assert.deepEqual(a,b);assert.equal(((a.runtime_result.EXACT_INSTANCE_PLAN as Record<string,unknown>).files as Record<string,Record<string,unknown>>)["a.ts"]!.sha256,sha256_text(content));});
