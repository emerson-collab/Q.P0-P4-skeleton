import { readExplicitRelationalSemantics } from "./contract_semantic_reader.ts";
import { planRelationalSchema } from "./relational_planner.ts";
import type { RelationalSchemaPlan } from "./relational_ir.ts";
export const MATERIALIZER_CONTRACT_REF = "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0178#/physical_model/materializer_projection" as const;
export function materializeRelationalSchema(input: unknown): RelationalSchemaPlan { return planRelationalSchema(readExplicitRelationalSemantics(input)); }
