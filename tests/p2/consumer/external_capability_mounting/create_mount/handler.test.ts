import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF, persist_created_mount_with_owner } from "#q/p2/consumer/external_capability_mounting/create_mount/handler.ts";
const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
function stable(v:unknown):unknown{return Array.isArray(v)?v.map(stable):(v!==null&&typeof v==="object"?Object.fromEntries(Object.keys(v as Record<string,unknown>).sort().map(k=>[k,stable((v as Record<string,unknown>)[k])])):v);}
const sha=(v:unknown)=>`sha256:${createHash("sha256").update(JSON.stringify(stable(v)),"utf8").digest("hex")}`;
const resolverPayload={publication_hash:`sha256:${"b".repeat(64)}`,implementation_artifact_ref:"artifact://implementation",implementation_artifact_hash:`sha256:${"c".repeat(64)}`,entry_symbol_ref:"src/p1/export/example/entry.ts#entry",local_material_binding_ref:"src/p1/export/example/entry.ts#entry"};
const resolver_state={...resolverPayload,binding_hash:sha(resolverPayload),verified:true};

test("create_mount binds exact canonical resolver_state and persists exact INACTIVE record",async()=>{
 const response=await handler(baseRequest({verified_publication:{verified:true,publication_hash:resolverPayload.publication_hash,publication:{immutable:true},resolver_state},receiving_domain_ref:"Q.RECEIVER.CONTRACT.DOMAIN@V0100",mount_policy:{mode:"PINNED"}}));
 const mount=response.runtime_result.mount as Record<string,unknown>;
 assert.deepEqual(mount.resolver_state,resolver_state);
 assert.equal(mount.implementation_binding_hash,sha(resolver_state));
 const store=new Map<string,Record<string,unknown>>();
 await persist_created_mount_with_owner(mount,{async persist_mount_record({mount_hash,mount}){store.set(mount_hash,mount as Record<string,unknown>);},async read_mount_record({mount_hash}){return store.get(mount_hash);}});
 assert.equal(store.size,1);
});

test("create_mount fails closed on resolver binding mismatch",async()=>{
 await assert.rejects(()=>handler(baseRequest({verified_publication:{verified:true,publication_hash:resolverPayload.publication_hash,resolver_state:{...resolver_state,binding_hash:`sha256:${"d".repeat(64)}`}},receiving_domain_ref:"Q.RECEIVER@V0100"})),(e:unknown)=>e instanceof P2StableError&&e.code==="P2_IMPLEMENTATION_BINDING_HASH_MISMATCH");
});
