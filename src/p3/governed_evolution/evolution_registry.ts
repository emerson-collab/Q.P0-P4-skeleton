import { handler as inspect_change } from "./inspect_change/handler.ts";
import { handler as create_candidate } from "./create_candidate/handler.ts";
import { handler as validate_candidate } from "./validate_candidate/handler.ts";
import { handler as approve_candidate } from "./approve_candidate/handler.ts";
import { handler as activate_candidate } from "./activate_candidate/handler.ts";
import { handler as evaluate_candidate } from "./evaluate_candidate/handler.ts";
import { handler as rollback_candidate } from "./rollback_candidate/handler.ts";
import { handler as read_receipt } from "./read_receipt/handler.ts";
/** Internal exact handler binding only; this is not a public REGISTRY interface surface. */
export const P3_OPERATION_REGISTRY=Object.freeze({inspect_change,create_candidate,validate_candidate,approve_candidate,activate_candidate,evaluate_candidate,rollback_candidate,read_receipt});
