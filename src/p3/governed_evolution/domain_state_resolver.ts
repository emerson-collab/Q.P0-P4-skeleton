import { P3Fault, sha256Jcs, type JsonObject } from "./stage_extension_contract.ts";
import type { DomainStateManifest } from "./evolution_state_store.ts";
const KINDS=new Set(["BUSINESS_OBJECT","ITEM","FIELD","SCHEMA","INTERFACE","CONTRACT","POLICY","CONFIGURATION","IMPLEMENTATION","PUBLICATION","DEPENDENCY","DATA","DEPLOYMENT","SECURITY_CONTROL"]);
const HASH=/^sha256:[0-9a-f]{64}$/;
export function validateCompleteDomainState(state:DomainStateManifest):void{
 if(!state.domain_ref||!state.domain_state_ref||!HASH.test(state.content_hash))throw new P3Fault("P3_DOMAIN_STATE_INCOMPLETE","domain state identity/hash incomplete");
 if(!Array.isArray(state.components)||!Array.isArray(state.capability_contract_map)||state.capability_contract_map.length===0)throw new P3Fault("P3_DOMAIN_STATE_INCOMPLETE","complete component and capability contract maps are required");
 for(const x of state.components){if(!KINDS.has(x.kind)||!x.versioned_ref||!HASH.test(x.content_hash)||!x.owner_ref||!x.compatibility_status||!x.owner_preparation_receipt_ref)throw new P3Fault("P3_DOMAIN_STATE_INCOMPLETE","applicable component semantics are incomplete");}
 for(const x of state.capability_contract_map){if(!x.capability_ref||!x.capability_contract_ref||!HASH.test(x.capability_contract_content_hash)||!x.compatibility_status)throw new P3Fault("P3_DOMAIN_STATE_INCOMPLETE","capability contract exact external hash binding is incomplete");}
 const {content_hash: _hash,...body}=state;if(sha256Jcs(body)!==state.content_hash)throw new P3Fault("P3_DOMAIN_STATE_INCOMPLETE","domain state content hash mismatch");
}
export interface CandidateDomainStateResolver{resolve(input:JsonObject):Promise<DomainStateManifest>;}
