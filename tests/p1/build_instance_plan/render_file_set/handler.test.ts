import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler } from "../../../../src/p1/build_instance_plan/render_file_set/handler.ts";
test("render_file_set is byte deterministic and fails no tokens",async()=>{ const input={EXACT_TEMPLATE_SET:{"a.ts":{content:"const n='{{name}}';"}},EXACT_BINDING_SET:{values:{name:"Q"}},EXACT_PHYSICAL_MANIFEST:["a.ts"]};const a=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});const b=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});assert.deepEqual(a,b);assert.equal((a.runtime_result.EXACT_RENDERED_FILE_SET as Record<string,string>)["a.ts"],"const n='Q';");});
