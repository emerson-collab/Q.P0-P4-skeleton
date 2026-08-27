import { P3Fault } from "./stage_extension_contract.ts";
export type EvaluationDecision="RETAIN"|"ADJUST"|"ROLLBACK"|"ESCALATE";
export function validateEvaluationDecision(value:string):EvaluationDecision{if(!(["RETAIN","ADJUST","ROLLBACK","ESCALATE"] as const).includes(value as EvaluationDecision))throw new P3Fault("P3_EVALUATION_FAILED","evaluation result is outside the closed outcome set");return value as EvaluationDecision;}
export interface OutcomeEvaluationResolver{evaluate(evaluationProfileRef:string,outcomeEvidenceRef:string):Promise<EvaluationDecision>;}
