import assert from "node:assert/strict";
import test from "node:test";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

import { handler, sha256_text } from "../../../../src/p1/domain_instantiation/compile_contract/handler.ts";

test("compile_contract verifies exact bytes identity active binding and is deterministic",async()=>{
  const bytes="q_id: X.CONTRACT\nq_version: V0001\nphysical_model:\n  target_file: src/x.ts\n";
  const input={EXACT_INPUT_CONTRACT:{exact_source_contract_ref:"X.CONTRACT@V0001",exact_source_contract_hash:sha256_text(bytes),exact_source_contract_bytes:bytes,source_provenance:{provider:"test"},selected_active_state_binding:"Q_STANDARD_SELECTED_ACTIVE_POINTER"}};
  const a=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});
  const b=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});
  assert.deepEqual(a,b);
  assert.equal((a.runtime_result.COMPILED_CONTRACT_REPRESENTATION as Record<string,unknown>).source_contract_ref,"X.CONTRACT@V0001");
});

test("compile_contract accepts governed Source YAML indentless sequences, sequence maps and folded scalars",async()=>{
  const bytes="q_id: X.CONTRACT\nq_version: V0002\nq_refs:\n  supersedes:\n  - X.CONTRACT@V0001\nresponsibilities:\n- first responsibility that\n  folds deterministically\nobjects:\n- object_id: one\n  assertion: 'quoted scalar that\n    also folds'\n";
  const input={EXACT_INPUT_CONTRACT:{exact_source_contract_ref:"X.CONTRACT@V0002",exact_source_contract_hash:sha256_text(bytes),exact_source_contract_bytes:bytes,source_provenance:{provider:"test"},selected_active_state_binding:"Q_STANDARD_SELECTED_ACTIVE_POINTER"}};
  const result=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});
  const compiled=result.runtime_result.COMPILED_CONTRACT_REPRESENTATION as Record<string,unknown>;
  const facts=compiled.normalized_facts as Record<string,unknown>;
  assert.deepEqual((facts.q_refs as Record<string,unknown>).supersedes,["X.CONTRACT@V0001"]);
  assert.deepEqual(facts.responsibilities,["first responsibility that folds deterministically"]);
  assert.deepEqual(facts.objects,[{object_id:"one",assertion:"quoted scalar that also folds"}]);
});
