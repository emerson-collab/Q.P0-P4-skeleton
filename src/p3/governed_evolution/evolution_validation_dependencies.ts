import { P3Fault } from "./stage_extension_contract.ts";
import type { CandidateDomainStateResolver } from "./domain_state_resolver.ts";
import type { ImpactGraphVerifier } from "./impact_graph_verifier.ts";
import type { ComponentOwnerReceiptVerifier } from "./component_owner_receipt_verifier.ts";
import type { OutcomeEvaluationResolver } from "./outcome_evaluation_handler.ts";
export interface InspectionResolution{readonly evolution_case_ref:string;readonly evidence_refs:readonly string[];readonly predicted_impact_graph_ref:string;readonly routing_decision:"P3"|"P4";}
export interface InspectionScopeResolver{readonly profile:"PRODUCTION"|"REFERENCE";inspect(domainRef:string,changeRef:string):Promise<InspectionResolution>;}
export interface OutcomeEvidenceVerifier{verify(evidenceRef:string):Promise<boolean>;}
export interface EvaluationProfileResolver{resolve(profileRef:string):Promise<{readonly trial_required:boolean}|null>;}
export interface P3ValidationDependencies{readonly inspection:InspectionScopeResolver;readonly candidateState:CandidateDomainStateResolver;readonly impact:ImpactGraphVerifier;readonly ownerReceipts:ComponentOwnerReceiptVerifier;readonly outcomeEvidence:OutcomeEvidenceVerifier;readonly evaluationProfiles:EvaluationProfileResolver;readonly outcomeEvaluation:OutcomeEvaluationResolver;}
export function assertProductionValidationDependencies(d:P3ValidationDependencies):void{if(d.inspection.profile!=="PRODUCTION")throw new P3Fault("P3_VALIDATION_PROFILE_INVALID","reference inspection resolver is forbidden in production");}
export class ReferenceInspectionScopeResolver implements InspectionScopeResolver{readonly profile="REFERENCE" as const;constructor(private readonly byChange:Readonly<Record<string,InspectionResolution>>){ }async inspect(_domainRef:string,changeRef:string){const v=this.byChange[changeRef];if(!v)throw new P3Fault("P3_CHANGE_NOT_FOUND","change authority not found");return v;}}
