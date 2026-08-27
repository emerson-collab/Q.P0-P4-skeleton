import { P3Fault } from "./stage_extension_contract.ts";
export interface LeaseState {readonly domain_ref:string;readonly lease_epoch:number;readonly fencing_token:string;readonly active:boolean;}
export interface EvolutionLeaseStore{read(domainRef:string):Promise<LeaseState|null>;}
export class ReferenceInMemoryLeaseStore implements EvolutionLeaseStore{readonly profile="REFERENCE_IN_MEMORY" as const;private readonly m=new Map<string,LeaseState>();seed(v:LeaseState){this.m.set(v.domain_ref,Object.freeze({...v}));}async read(d:string){return this.m.get(d)??null;}}
export async function verifyLease(store:EvolutionLeaseStore,domainRef:string,epoch:number,token:string):Promise<void>{const l=await store.read(domainRef);if(!l||!l.active||l.lease_epoch!==epoch)throw new P3Fault("P3_LEASE_INVALID","lease is missing, inactive, or epoch-mismatched");if(l.fencing_token!==token)throw new P3Fault("P3_FENCING_REJECTED","fencing token rejected");}
