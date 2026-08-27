import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler } from "../../../../src/p1/domain_instantiation/verify_instance/handler.ts";
test("verify_instance closes exact resulting revision file set and hashes",async()=>{ const h=`sha256:${"c".repeat(64)}`; const r=await handler({input:{EXACT_INSTANCE_PLAN:{files:{"a.ts":{sha256:h}},replay_identity_hash:"x"},MATERIALIZED_REPOSITORY:{resulting_repository_revision:"rev1"}},runtime_context:ctx,trace_id:"t",request_id:"r"},async()=>({outcome_type:"response",runtime_result:{EXACT_REPOSITORY_READBACK:{resulting_repository_revision:"rev1",file_hashes:{"a.ts":h}}},trace_id:"t",request_id:"r"})); assert.equal((r.runtime_result.VERIFICATION_REPORT as Record<string,unknown>).verified,true);});
