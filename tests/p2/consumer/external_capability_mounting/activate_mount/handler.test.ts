import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler as publishHandler } from "#q/p2/provider/capability_publishing/publish_capability/handler.ts";
import { handler as consumeHandler } from "#q/p2/consumer/external_capability_mounting/consume_publication/handler.ts";
import { handler as createHandler, persist_created_mount_with_owner } from "#q/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import { handler, P2StableError, STAGE_CONTRACT_REF, commit_active_mount_with_owner, recover_active_mount_with_owner } from "#q/p2/consumer/external_capability_mounting/activate_mount/handler.ts";

const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
function stable(v:unknown):unknown{return Array.isArray(v)?v.map(stable):(v!==null&&typeof v==="object"?Object.fromEntries(Object.keys(v as Record<string,unknown>).sort().map(k=>[k,stable((v as Record<string,unknown>)[k])])):v);}
const sha=(v:unknown)=>`sha256:${createHash("sha256").update(JSON.stringify(stable(v)),"utf8").digest("hex")}`;
const resolverPayload={publication_hash:`sha256:${"b".repeat(64)}`,implementation_artifact_ref:"artifact://implementation",implementation_artifact_hash:`sha256:${"c".repeat(64)}`,entry_symbol_ref:"src/p1/export/example/entry.ts#entry",local_material_binding_ref:"src/p1/export/example/entry.ts#entry"};
const resolver_state={...resolverPayload,binding_hash:sha(resolverPayload),verified:true};
const implementation_binding_hash=sha(resolver_state);
const mountPolicy={mode:"PINNED"};
const receiving_domain_ref="Q.RECEIVER.CONTRACT.DOMAIN@V0100";
const mount_hash=sha({receiving_domain_ref,publication_hash:resolverPayload.publication_hash,implementation_binding_hash,mount_policy:mountPolicy});
const mount={receiving_domain_ref,publication_hash:resolverPayload.publication_hash,mount_hash,status:"INACTIVE",verified_publication:{verified:true,publication_hash:resolverPayload.publication_hash,resolver_state},resolver_state,implementation_binding_hash,mount_policy:mountPolicy};

test("activate_mount preserves exact resolver identity",async()=>{
 const response=await handler(baseRequest({mount}));
 const active=response.runtime_result.active_mount as Record<string,unknown>;
 assert.equal(active.status,"ACTIVE");
 assert.equal(active.implementation_binding_hash,implementation_binding_hash);
 assert.deepEqual(active.resolver_state,resolver_state);
});

test("publish→consume→create→persist→activate→recover closes with exact V0119 identities",async()=>{
 const artifactBinding={artifact_ref:"Q.CAPABILITY_PACKAGE.EXAMPLE.EXAMPLE@V0100#/implementation_material",content_hash:`sha256:${"c".repeat(64)}`,provider_neutral_locator_binding:{object_id:"immutable-1"},entry_symbol_ref:"src/p1/export/example/entry.ts#entry",immutable:true};
 const materialSet={publication_eligible:true,capability_contract_ref:"Q.EXAMPLE.CONTRACT.CAPABILITY.EXAMPLE@V0100",capability_contract_hash:`sha256:${"a".repeat(64)}`,material_set_hash:`sha256:${"d".repeat(64)}`,provider_lineage:["Q.EXAMPLE.CONTRACT.DOMAIN@V0100"],dependency_closure:[]};
 const published=await publishHandler(baseRequest({material_set:materialSet,publication_artifact_binding:artifactBinding}));
 const publication=published.runtime_result.publication as Record<string,unknown>;
 const consumed=await consumeHandler(baseRequest({publication,verification:{integrity_verified:true,local_material_binding_ref:"src/p1/export/example/entry.ts#entry"}}));
 const verified=consumed.runtime_result.verified_publication as Record<string,unknown>;
 const created=await createHandler(baseRequest({verified_publication:verified,receiving_domain_ref,mount_policy:{}}));
 const createdMount=created.runtime_result.mount as Record<string,unknown>;
 const mounts=new Map<string,Record<string,unknown>>();
 const pointers=new Map<string,Record<string,unknown>>();
 const persistence={
  async persist_mount_record({mount_hash,mount}:{mount_hash:string;mount:Readonly<Record<string,unknown>>}){mounts.set(mount_hash,mount as Record<string,unknown>);},
  async read_mount_record({mount_hash}:{mount_hash:string}){return mounts.get(mount_hash);},
  async reverify_implementation_material({implementation_binding_hash,resolver_state}:{implementation_binding_hash:string;resolver_state:Readonly<Record<string,unknown>>}){assert.equal(implementation_binding_hash,sha(resolver_state));assert.equal(resolver_state.verified,true);},
  async read_active_pointer({receiving_domain_ref}:{receiving_domain_ref:string}){return pointers.get(receiving_domain_ref);},
  async switch_active_pointer({receiving_domain_ref,mount_hash}:{receiving_domain_ref:string;mount_hash:string}){pointers.set(receiving_domain_ref,{receiving_domain_ref,mount_hash,status:"ACTIVE"});},
 };
 await persist_created_mount_with_owner(createdMount,persistence);
 const activated=await handler(baseRequest({mount:createdMount}));
 const active=activated.runtime_result.active_mount as Record<string,unknown>;
 await commit_active_mount_with_owner(active,persistence);
 const recovered=await recover_active_mount_with_owner(receiving_domain_ref,persistence);
 assert.equal(recovered.status,"ACTIVE");
 assert.equal(recovered.mount_hash,createdMount.mount_hash);
 assert.deepEqual(recovered.resolver_state,createdMount.resolver_state);
});

test("activate_mount fails closed when canonical resolver hash differs",async()=>{
 await assert.rejects(()=>handler(baseRequest({mount:{...mount,implementation_binding_hash:`sha256:${"e".repeat(64)}`}})),(e:unknown)=>e instanceof P2StableError&&e.code==="P2_IMPLEMENTATION_BINDING_HASH_MISMATCH");
});
