import test from "node:test";
import assert from "node:assert/strict";
import { handler as exposeHandler } from "#q/p2/provider/governed_data_exposure/expose_runtime_data/handler.ts";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/governed_data_consumption/consume_runtime_data/handler.ts";

const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
const exposureRequest={subject_ref:"subject-1",requested_representation:"ARTIFACT_SNAPSHOT",selection_spec:{scope:"authorized"}};
const envelope={material_ref:"urn:q:material:1",subject_ref:"subject-1",owner_ref:"Q.SOURCE.CONTRACT.DOMAIN@V0100",source_ref:"Q.SOURCE.FACT@V0100",representation_mode:"ARTIFACT_SNAPSHOT",content_hash:`sha256:${"a".repeat(64)}`,integrity_profile_ref:"Q.INTEGRITY.PROFILE@V0100",snapshot_ref:"urn:q:snapshot:runtime",manifest_ref:"urn:q:manifest:runtime"};
const exposureDeps={async materialize_governed_data(){return envelope;}};

test("expose_runtime_data→consume_runtime_data preserves CURRENT governed material identity",async()=>{
 const exposed=await exposeHandler(baseRequest({authorized_exposure_request:exposureRequest,exact_source_authority:{ref:"Q.SOURCE"},owning_persistence_contract:{ref:"Q.DB"},integrity_profile:{ref:"Q.INTEGRITY"},artifact_store_binding:{ref:"Q.ARTIFACT"},reexecution_requested:false}),exposureDeps);
 const material=exposed.runtime_result.material_envelope as Record<string,unknown>;
 let calls=0;
 const consumed=await handler(baseRequest({material_envelope:material,consumer_binding:{authorization_ref:"auth-1"}}),{async consume_governed_data(input){calls+=1;assert.equal(input.data_category,"RUNTIME");assert.deepEqual(input.governed_material_envelope,material);return {delivered:true};}});
 assert.equal(calls,1);
 const binding=consumed.runtime_result.data_consumption_binding as Record<string,unknown>;
 assert.equal(binding.data_category,"RUNTIME");
 assert.equal(binding.material_ref,envelope.material_ref);
 assert.equal(binding.content_hash,envelope.content_hash);
 assert.deepEqual(binding.consumption_result,{delivered:true});
 assert.equal(binding.full_memory_assembly_required,false);
 assert.equal(binding.creates_evidence_or_gate_result,false);
});

test("consume_runtime_data fails closed on invalid material envelope hash identity",async()=>{
 await assert.rejects(()=>handler(baseRequest({material_envelope:{...envelope,content_hash:"bad"},consumer_binding:{authorization_ref:"auth-1"}}),{async consume_governed_data(){return {};}}),(e:unknown)=>e instanceof P2StableError&&e.code==="P2_INTEGRITY_BINDING_INVALID");
});
