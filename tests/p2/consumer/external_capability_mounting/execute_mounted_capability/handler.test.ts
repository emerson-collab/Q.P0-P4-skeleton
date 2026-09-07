import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/execute_mounted_capability/handler.ts";
const baseRequest=(input:Record<string,unknown>)=>({input,runtime_context:{stage_contract_ref:STAGE_CONTRACT_REF},trace_id:"trace-p2",request_id:"request-p2"});
function stable(v:unknown):unknown{return Array.isArray(v)?v.map(stable):(v!==null&&typeof v==="object"?Object.fromEntries(Object.keys(v as Record<string,unknown>).sort().map(k=>[k,stable((v as Record<string,unknown>)[k])])):v);}
const sha=(v:unknown)=>`sha256:${createHash("sha256").update(JSON.stringify(stable(v)),"utf8").digest("hex")}`;
const resolverPayload={publication_hash:`sha256:${"b".repeat(64)}`,implementation_artifact_ref:"artifact://implementation",implementation_artifact_hash:`sha256:${"c".repeat(64)}`,entry_symbol_ref:"src/p1/export/example/entry.ts#entry",local_material_binding_ref:"src/p1/export/example/entry.ts#entry"};
const resolver_state={...resolverPayload,binding_hash:sha(resolverPayload),verified:true};
const implementation_binding_hash=sha(resolver_state);
const active_mount={mount_hash:`sha256:${"a".repeat(64)}`,status:"ACTIVE",resolver_state,implementation_binding_hash};

test("execute_mounted_capability passes exact resolver_state to local P0 and emits deterministic receipt",async()=>{
 let calls=0;
 const interfaceBinding={interface_ref:"Q.PROVIDER.CONTRACT.CAPABILITY.X@V0100#/interfaces/run_invoke",surface:"CALL",kind_code:"M1"};
 const response=await handler(baseRequest({active_mount,exact_interface_binding:interfaceBinding,operation_input:{value:1}}),{async invoke_local_p0(input){calls+=1;assert.deepEqual(input.implementation_binding,resolver_state);assert.equal(input.exact_interface_binding.interface_ref,interfaceBinding.interface_ref);return {ok:true};}});
 assert.equal(calls,1);
 const execution=response.runtime_result.mounted_execution as Record<string,unknown>;
 assert.equal(execution.implementation_binding_hash,implementation_binding_hash);
 const receipt=response.runtime_result.execution_receipt as Record<string,unknown>;
 const payload=receipt.receipt_payload as Record<string,unknown>;
 assert.equal(payload.implementation_binding_hash,implementation_binding_hash);
 assert.equal(payload.active_mount_hash,active_mount.mount_hash);
 assert.equal(payload.runtime_result_hash,sha({ok:true}));
 assert.equal(receipt.receipt_hash,sha(payload));
 assert.equal(receipt.receipt_ref,`urn:q:p2:execution-receipt:${String(receipt.receipt_hash).slice("sha256:".length)}`);
});

test("execute_mounted_capability fails closed on protocol translation",async()=>{
 await assert.rejects(()=>handler(baseRequest({active_mount,exact_interface_binding:{interface_ref:"x",translation:true},operation_input:{}}),{async invoke_local_p0(){return {};}}),(e:unknown)=>e instanceof P2StableError&&e.code==="P2_PROTOCOL_TRANSLATION_FORBIDDEN");
});
