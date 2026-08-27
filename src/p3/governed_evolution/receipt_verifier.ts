import { P3Fault, sha256Jcs, type EvolutionReceipt } from "./stage_extension_contract.ts";
import type { EvolutionReceiptStore } from "./evolution_receipt_store.ts";
export function verifyReceiptHash(receipt:EvolutionReceipt):void { const {receipt_ref: _ref,receipt_hash,...body}=receipt; const expected=sha256Jcs(body); if(expected!==receipt_hash)throw new P3Fault("P3_RECEIPT_INVALID","receipt hash mismatch"); }
export async function verifyReceiptChain(store:EvolutionReceiptStore, receipt:EvolutionReceipt):Promise<void>{verifyReceiptHash(receipt); if(receipt.previous_receipt_ref){const p=await store.get(receipt.previous_receipt_ref); if(!p)throw new P3Fault("P3_RECEIPT_INVALID","previous receipt is missing"); verifyReceiptHash(p);}}
