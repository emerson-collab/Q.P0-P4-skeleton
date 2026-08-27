import { failClosed, type P3Call, type P3Result } from "../stage_extension_contract.ts";
import { P3_OPERATION_ERRORS } from "../stable_errors.ts";
import type { P3EvolutionRuntime } from "../evolution_runtime_binding.ts";
export const OPERATION_ID="activate_candidate" as const;
export async function handler(call:P3Call,runtime:P3EvolutionRuntime):Promise<P3Result>{return await failClosed(call,P3_OPERATION_ERRORS.activate_candidate,()=>runtime.activateCandidate(call));}
