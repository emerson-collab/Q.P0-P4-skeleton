import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/provider/governed_data_exposure/expose_dynamic_data/handler.ts";

const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
const request={subject_ref:"subject-1",requested_representation:"ARTIFACT_CHUNKED_SNAPSHOT",selection_spec:{scope:"authorized"}};
const envelope={material_ref:"urn:q:material:1",subject_ref:"subject-1",owner_ref:"Q.SOURCE.CONTRACT.DOMAIN@V0100",source_ref:"Q.SOURCE.FACT@V0100",representation_mode:"ARTIFACT_CHUNKED_SNAPSHOT",content_hash:`sha256:${"a".repeat(64)}`,integrity_profile_ref:"Q.INTEGRITY.PROFILE@V0100",snapshot_ref:"urn:q:snapshot:1",manifest_ref:"urn:q:manifest:1"};
const deps={async materialize_governed_data(input:Readonly<Record<string,unknown>>){assert.equal(input.data_category,"DYNAMIC");assert.deepEqual(input.authorized_exposure_request,request);return envelope;}};

test("expose_dynamic_data returns CURRENT material_envelope under runtime_result",async()=>{
 const response=await handler(baseRequest({authorized_exposure_request:request,exact_source_authority:{ref:"Q.SOURCE"},owning_persistence_contract:{ref:"Q.DB"},integrity_profile:{ref:"Q.INTEGRITY"},artifact_store_binding:{ref:"Q.ARTIFACT"}}),deps);
 assert.equal(response.runtime_result.data_category,"DYNAMIC");
 assert.deepEqual(response.runtime_result.material_envelope,envelope);
});

test("expose_dynamic_data fails closed on invalid provider materialization",async()=>{
 await assert.rejects(()=>handler(baseRequest({authorized_exposure_request:{...request,requested_representation:"INVALID"},exact_source_authority:{},owning_persistence_contract:{},integrity_profile:{},artifact_store_binding:{}}),deps),(e:unknown)=>e instanceof P2StableError&&e.code==="P2_GOVERNED_DATA_REPRESENTATION_INVALID");
});
