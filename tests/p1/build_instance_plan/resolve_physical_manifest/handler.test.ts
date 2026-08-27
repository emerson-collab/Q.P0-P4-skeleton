import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler } from "../../../../src/p1/build_instance_plan/resolve_physical_manifest/handler.ts";
test("resolve_physical_manifest closes Contract and Stage-declared paths including nested operation maps",async()=>{ const r=await handler({input:{COMPILED_CONTRACT:{normalized_facts:{physical_model:{target_file:"src/a.ts",operation_source_files:{execute:["src/p1/a/execute/handler.ts"]},operation_test_files:{execute:["tests/p1/a/execute/handler.test.ts"]}}}},EXACT_AUTHORITY_SNAPSHOT:{stage:{physical_model:{required_files:["spec/a.qcon"]}}}},runtime_context:ctx,trace_id:"t",request_id:"r"});assert.deepEqual(r.runtime_result.EXACT_PHYSICAL_MANIFEST,["spec/a.qcon","src/a.ts","src/p1/a/execute/handler.ts","tests/p1/a/execute/handler.test.ts"]);});
