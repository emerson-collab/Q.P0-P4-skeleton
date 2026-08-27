import { verify as verifySignature } from "node:crypto";
import { P3Fault, asInteger, asString, sha256Jcs, type JsonObject, type JsonValue } from "./stage_extension_contract.ts";
import { authorizationSigningPayload, type AuthorizedMethod, type CoordinationAuthorization } from "./coordination_authorization_contract.ts";
import type { AuthorizationTrustStore } from "./authorization_trust_store.ts";
import type { AuthorizationConsumptionStore } from "./authorization_consumption_store.ts";
export interface AuthorizationExpectation {readonly method:AuthorizedMethod;readonly input:JsonObject;readonly method_specific_subject:JsonValue;}
export interface VerifiedAuthorization {readonly authorization_ref:string;readonly nonce:string;readonly exact_semantic_request_hash:string;}
function b64url(s:string):Buffer{if(!/^[A-Za-z0-9_-]+$/.test(s))throw new P3Fault("P3_AUTHORIZATION_INVALID","signature encoding invalid");return Buffer.from(s,"base64url");}
export async function verifyAuthorization(auth:CoordinationAuthorization,expected:AuthorizationExpectation,trust:AuthorizationTrustStore,consumption:AuthorizationConsumptionStore,now=new Date()):Promise<VerifiedAuthorization>{
 const c=auth.claims;if(c.method!==expected.method)throw new P3Fault("P3_AUTHORIZATION_INVALID","authorization method mismatch");
 const h=sha256Jcs(expected.input);if(c.exact_semantic_request_hash!==h)throw new P3Fault("P3_AUTHORIZATION_INVALID","exact semantic request hash mismatch");
 const required:[keyof JsonObject,string][]=[["change_set_ref",c.change_set],["activation_plan_ref",c.activation_plan],["target_domain_ref",c.domain],["target_step_ref",c.step],["expected_active_version",c.expected_version],["fencing_token",c.fencing_token]];
 for(const [field,v] of required)if(asString(expected.input[field],String(field))!==v)throw new P3Fault("P3_AUTHORIZATION_INVALID",`${String(field)} binding mismatch`);
 if(asInteger(expected.input.lease_epoch,"lease_epoch")!==c.lease_epoch)throw new P3Fault("P3_AUTHORIZATION_INVALID","lease epoch binding mismatch");
 if(JSON.stringify(c.method_specific_subject)!==JSON.stringify(expected.method_specific_subject))throw new P3Fault("P3_AUTHORIZATION_INVALID","method-specific subject mismatch");
 const issued=Date.parse(c.issued_at),expires=Date.parse(c.expires_at);if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now.getTime()||expires<=now.getTime())throw new P3Fault("P3_AUTHORIZATION_EXPIRED","authorization is outside its validity window");
 if(await consumption.get(c.authorization_ref))throw new P3Fault("P3_AUTHORIZATION_REPLAYED","authorization already consumed");
 const a=await trust.resolve(c.key_id,c.key_version);if(!a||a.status==="revoked"||a.revocation_epoch!==c.revocation_epoch)throw new P3Fault("P3_TRUST_ANCHOR_INVALID","public trust anchor or revocation state invalid");
 const ok=verifySignature("sha256",Buffer.from(authorizationSigningPayload(c),"utf8"),a.public_key_pem,b64url(auth.signature));if(!ok)throw new P3Fault("P3_AUTHORIZATION_INVALID","ECDSA authorization signature invalid");
 return Object.freeze({authorization_ref:c.authorization_ref,nonce:c.nonce,exact_semantic_request_hash:h});
}
