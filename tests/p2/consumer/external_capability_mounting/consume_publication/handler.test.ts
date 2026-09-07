import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/consume_publication/handler.ts";

const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
function canonical(value:unknown):string{const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):(v!==null&&typeof v==="object"?Object.fromEntries(Object.keys(v as Record<string,unknown>).sort().map(k=>[k,stable((v as Record<string,unknown>)[k])])):v);return JSON.stringify(stable(value));}
const sha=(v:unknown)=>`sha256:${createHash("sha256").update(canonical(v),"utf8").digest("hex")}`;
const publication_artifact_binding={artifact_ref:"artifact://implementation",content_hash:`sha256:${"c".repeat(64)}`,entry_symbol_ref:"src/p1/export/example/entry.ts#entry",immutable:true,provider_neutral_locator_binding:{locator_ref:"q-storage://implementation"}};

test("consume_publication materializes exact V0119 resolver_state",async()=>{
 const publication_hash=`sha256:${"b".repeat(64)}`;
 const response=await handler(baseRequest({publication:{immutable:true,capability_contract_ref:"Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",capability_contract_hash:`sha256:${"a".repeat(64)}`,publication_hash,publication_artifact_binding},verification:{integrity_verified:true,local_material_binding_ref:"src/p1/export/example/entry.ts#entry"}}));
 const verified=response.runtime_result.verified_publication as Record<string,unknown>;
 const resolver=verified.resolver_state as Record<string,unknown>;
 const payload={publication_hash,implementation_artifact_ref:publication_artifact_binding.artifact_ref,implementation_artifact_hash:publication_artifact_binding.content_hash,entry_symbol_ref:publication_artifact_binding.entry_symbol_ref,local_material_binding_ref:"src/p1/export/example/entry.ts#entry"};
 assert.deepEqual(resolver,{...payload,binding_hash:sha(payload),verified:true});
});

test("consume_publication fails closed without verified local material binding",async()=>{
 await assert.rejects(()=>handler(baseRequest({publication:{immutable:true,capability_contract_ref:"Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",capability_contract_hash:`sha256:${"a".repeat(64)}`,publication_hash:`sha256:${"b".repeat(64)}`,publication_artifact_binding},verification:{integrity_verified:true}})),(e:unknown)=>e instanceof P2StableError);
});
