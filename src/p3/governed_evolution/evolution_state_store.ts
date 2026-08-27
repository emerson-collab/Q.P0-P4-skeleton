import { P3Fault, sha256Jcs, type JsonObject, type JsonValue } from "./stage_extension_contract.ts";
export interface DomainComponent extends JsonObject { readonly kind: string; readonly versioned_ref: string; readonly content_hash: string; readonly owner_ref: string; readonly compatibility_status: string; readonly owner_preparation_receipt_ref: string; }
export interface CapabilityContractMapEntry extends JsonObject { readonly capability_ref: string; readonly capability_contract_ref: string; readonly capability_contract_content_hash: string; readonly compatibility_status: string; }
export interface DomainStateManifest extends JsonObject { readonly domain_state_ref: string; readonly domain_ref: string; readonly content_hash: string; readonly components: readonly DomainComponent[]; readonly capability_contract_map: readonly CapabilityContractMapEntry[]; }
export interface EvolutionCandidate extends JsonObject { readonly candidate_ref: string; readonly candidate_hash: string; readonly domain_ref: string; readonly domain_state_ref: string; readonly domain_state_hash: string; readonly expected_active_version: string; readonly evolution_case_ref: string; readonly predicted_impact_graph_ref: string; readonly routing_decision?: "P3"|"P4"; readonly evidence_refs: readonly string[]; readonly component_owner_receipt_refs: readonly string[]; }
export interface EvolutionValidation extends JsonObject { readonly validation_ref: string; readonly candidate_ref: string; readonly candidate_hash: string; readonly validation_status: string; readonly verified_impact_graph_ref: string; readonly routing_decision: string; }
export interface EvolutionApproval extends JsonObject { readonly approval_ref: string; readonly candidate_ref: string; readonly validation_ref: string; readonly approval_status: string; readonly approval_scope: JsonValue; readonly routing_decision: string; }
export interface EvolutionEvaluation extends JsonObject { readonly evaluation_ref: string; readonly candidate_ref: string; readonly evaluation_result: "RETAIN"|"ADJUST"|"ROLLBACK"|"ESCALATE"; }
export interface ActivePointer extends JsonObject { readonly active_pointer_ref: string; readonly domain_ref: string; readonly active_version: string; readonly domain_state_ref: string; readonly domain_state_hash: string; }
export interface TrialPointer extends JsonObject { readonly trial_pointer_ref: string; readonly domain_ref: string; readonly candidate_ref: string; readonly version: string; }
export interface RollbackTarget extends JsonObject { readonly rollback_target_ref:string;readonly domain_ref:string;readonly active_version:string;readonly domain_state_ref:string;readonly domain_state_hash:string;readonly evolution_case_ref:string;readonly irreversible_migration:boolean;readonly forward_recovery_plan_ref:string|null; }
export interface EvolutionStateStore {
  getCandidate(ref: string): Promise<EvolutionCandidate | null>; putCandidate(candidate: EvolutionCandidate): Promise<void>;
  getValidation(ref: string): Promise<EvolutionValidation | null>; putValidation(value: EvolutionValidation): Promise<void>;
  getApproval(ref: string): Promise<EvolutionApproval | null>; putApproval(value: EvolutionApproval): Promise<void>;
  getEvaluation(ref: string): Promise<EvolutionEvaluation | null>; putEvaluation(value: EvolutionEvaluation): Promise<void>;
  getActivePointer(domainRef: string): Promise<ActivePointer | null>; compareAndSwapActive(domainRef: string, expectedVersion: string, next: ActivePointer): Promise<void>;
  getTrialPointer(domainRef: string): Promise<TrialPointer | null>; compareAndSwapTrial(domainRef: string, expectedRef: string | null, next: TrialPointer | null): Promise<void>;
  resolveRollbackTarget(ref:string):Promise<RollbackTarget|null>;
}
export class ReferenceInMemoryEvolutionStateStore implements EvolutionStateStore {
  readonly profile = "REFERENCE_IN_MEMORY" as const;
  private readonly candidates=new Map<string,EvolutionCandidate>(); private readonly validations=new Map<string,EvolutionValidation>(); private readonly approvals=new Map<string,EvolutionApproval>(); private readonly evaluations=new Map<string,EvolutionEvaluation>(); private readonly active=new Map<string,ActivePointer>(); private readonly trial=new Map<string,TrialPointer>(); private readonly rollbackTargets=new Map<string,RollbackTarget>();
  async getCandidate(r:string){return this.candidates.get(r)??null;} async putCandidate(v:EvolutionCandidate){this.candidates.set(v.candidate_ref,Object.freeze({...v}));}
  async getValidation(r:string){return this.validations.get(r)??null;} async putValidation(v:EvolutionValidation){this.validations.set(v.validation_ref,Object.freeze({...v}));}
  async getApproval(r:string){return this.approvals.get(r)??null;} async putApproval(v:EvolutionApproval){this.approvals.set(v.approval_ref,Object.freeze({...v}));}
  async getEvaluation(r:string){return this.evaluations.get(r)??null;} async putEvaluation(v:EvolutionEvaluation){this.evaluations.set(v.evaluation_ref,Object.freeze({...v}));}
  async getActivePointer(d:string){return this.active.get(d)??null;}
  async compareAndSwapActive(d:string,e:string,n:ActivePointer){const cur=this.active.get(d); const v=cur?.active_version??""; if(v!==e) throw new P3Fault("P3_ACTIVE_VERSION_CONFLICT",`expected active version ${e}, found ${v}`); this.active.set(d,Object.freeze({...n}));}
  async getTrialPointer(d:string){return this.trial.get(d)??null;}
  async compareAndSwapTrial(d:string,e:string|null,n:TrialPointer|null){const cur=this.trial.get(d)??null; if((cur?.trial_pointer_ref??null)!==e) throw new P3Fault("P3_ACTIVE_VERSION_CONFLICT","trial pointer compare-and-swap failed"); if(n===null)this.trial.delete(d);else this.trial.set(d,Object.freeze({...n}));}
  async resolveRollbackTarget(r:string){return this.rollbackTargets.get(r)??null;}
  seedActive(pointer:ActivePointer){this.active.set(pointer.domain_ref,Object.freeze({...pointer}));}
  seedRollbackTarget(target:RollbackTarget){this.rollbackTargets.set(target.rollback_target_ref,Object.freeze({...target}));}
}
export function makeRef(prefix:string, value:JsonValue):string { return `${prefix}:${sha256Jcs(value).slice(7,31)}`; }
