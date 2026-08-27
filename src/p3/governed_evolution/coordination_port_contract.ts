import type { JsonObject, P3Result } from "./stage_extension_contract.ts";
export const P3_COORDINATION_PORT_METHODS=Object.freeze(["request_candidate","request_activation","request_rollback","read_receipt"] as const);
export type P3CoordinationMethod=(typeof P3_COORDINATION_PORT_METHODS)[number];
export interface P3CoordinationCall {readonly method:P3CoordinationMethod;readonly input:JsonObject;readonly context:JsonObject;readonly trace_id:string;readonly request_id:string;}
export interface P3CoordinationPortProvider {request_candidate(call:P3CoordinationCall):Promise<P3Result>;request_activation(call:P3CoordinationCall):Promise<P3Result>;request_rollback(call:P3CoordinationCall):Promise<P3Result>;read_receipt(call:P3CoordinationCall):Promise<P3Result>;}
