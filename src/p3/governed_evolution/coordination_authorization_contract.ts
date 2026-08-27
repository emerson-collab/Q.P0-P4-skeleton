import { canonicalJcs, sha256Jcs, type JsonObject, type JsonValue } from "./stage_extension_contract.ts";
export const COORDINATION_AUTHORIZATION_PROFILE=Object.freeze({algorithm:"ECDSA_P256_SHA256",canonicalization:"RFC8785_JCS",encoding:"base64url_without_padding"} as const);
export type AuthorizedMethod="request_activation"|"request_rollback";
export interface CoordinationAuthorizationClaims extends JsonObject {readonly authorization_ref:string;readonly method:AuthorizedMethod;readonly change_set:string;readonly activation_plan:string;readonly domain:string;readonly step:string;readonly expected_version:string;readonly lease_epoch:number;readonly fencing_token:string;readonly exact_semantic_request_hash:string;readonly key_id:string;readonly key_version:number;readonly revocation_epoch:number;readonly issued_at:string;readonly expires_at:string;readonly nonce:string;readonly method_specific_subject:JsonValue;}
export interface CoordinationAuthorization extends JsonObject {readonly claims:CoordinationAuthorizationClaims;readonly signature:string;}
export function authorizationSigningPayload(claims:CoordinationAuthorizationClaims):string{return canonicalJcs(claims);}
export function exactSemanticRequestHash(input:JsonObject):string{return sha256Jcs(input);}
