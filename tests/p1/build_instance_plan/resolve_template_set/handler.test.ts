import assert from "node:assert/strict";
import test from "node:test";
import { handler, resolve_governed_template_from_catalog, sha256_text, TemplateStableError, type GovernedTemplateRecord } from "../../../../src/p1/build_instance_plan/resolve_template_set/handler.ts";
const ctx={stage_contract_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",operation_ref:"op",trace_id:"t",request_id:"r"} as const;

test("governed resolver selects exactly one local template by explicit path and exact authority binding",()=>{
  const content="hello {{name}}";
  const catalog:GovernedTemplateRecord[]=[{template_ref:"Q.TEMPLATE.TEMPLATE.P1.TEST@V0100",template_hash:sha256_text(content),content,tokens:{name:{contract_path:"identity.name"}},target_paths:["x.txt"],authority_bindings:[{snapshot_ref_path:"p1.ref",snapshot_hash_path:"p1.hash",exact_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",exact_hash:`sha256:${"1".repeat(64)}`}]}];
  const resolved=resolve_governed_template_from_catalog("x.txt",{p1:{ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174",hash:`sha256:${"1".repeat(64)}`}},catalog);
  assert.equal(resolved.template_ref,"Q.TEMPLATE.TEMPLATE.P1.TEST@V0100");
  assert.equal(resolved.template_hash,sha256_text(content));
});

test("governed resolver fails closed on zero or multiple eligible templates",()=>{
  assert.throws(()=>resolve_governed_template_from_catalog("x.txt",{},[]),(error:unknown)=>error instanceof TemplateStableError && /No eligible/.test(error.message));
  const content="x";
  const record:GovernedTemplateRecord={template_ref:"Q.TEMPLATE.TEMPLATE.P1.TEST@V0100",template_hash:sha256_text(content),content,target_paths:["x.txt"],authority_bindings:[]};
  assert.throws(()=>resolve_governed_template_from_catalog("x.txt",{},[record,record]),(error:unknown)=>error instanceof TemplateStableError && /Multiple eligible/.test(error.message));
});

test("resolve_template_set preserves exact governed legacy input compatibility",async()=>{
  const content="hello {{name}}";
  const input={EXACT_PHYSICAL_MANIFEST:["x.txt"],EXACT_AUTHORITY_SNAPSHOT:{p1_ref:"Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174"},GOVERNED_TEMPLATE_AUTHORITY_SET:{"x.txt":{template_ref:"Q.TEMPLATE.TEMPLATE.P1.TEST@V0100",template_hash:sha256_text(content),content,tokens:{name:{contract_path:"identity.name"}}}}};
  const result=await handler({input,runtime_context:ctx,trace_id:"t",request_id:"r"});
  const exactSet=result.runtime_result.EXACT_TEMPLATE_SET as Record<string,Record<string,unknown>>;
  const exactTemplate=exactSet["x.txt"];
  assert.ok(exactTemplate);
  assert.equal(exactTemplate.template_hash,sha256_text(content));
});
