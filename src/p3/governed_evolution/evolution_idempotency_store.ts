import { P3Fault, sha256Jcs, type JsonObject } from "./stage_extension_contract.ts";
export interface IdempotencyRecord<R extends JsonObject = JsonObject> extends JsonObject { readonly idempotency_key:string; readonly canonical_request_hash:string; readonly result_hash:string; readonly result:R; }
export interface EvolutionIdempotencyStore { get(key:string):Promise<IdempotencyRecord|null>; put(record:IdempotencyRecord):Promise<void>; }
export class ReferenceInMemoryIdempotencyStore implements EvolutionIdempotencyStore { readonly profile="REFERENCE_IN_MEMORY" as const; private readonly records=new Map<string,IdempotencyRecord>(); async get(k:string){return this.records.get(k)??null;} async put(r:IdempotencyRecord){if(this.records.has(r.idempotency_key))throw new P3Fault("P3_IDEMPOTENCY_RACE","idempotency record already exists"); this.records.set(r.idempotency_key,Object.freeze({...r}));} }
export async function idempotent<R extends JsonObject>(store:EvolutionIdempotencyStore,key:string,request:JsonObject,conflictCode:string,execute:()=>Promise<R>):Promise<R>{
 const h=sha256Jcs(request); const prior=await store.get(key); if(prior){if(prior.canonical_request_hash!==h)throw new P3Fault(conflictCode,"same idempotency key used with a different canonical request"); return prior.result as R;}
 const result=await execute(); const record:Object & IdempotencyRecord={idempotency_key:key,canonical_request_hash:h,result_hash:sha256Jcs(result),result}; await store.put(record); return result;
}
