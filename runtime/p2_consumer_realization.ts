import { handler as consumePublication } from "../src/p2/consumer/external_capability_mounting/consume_publication/handler.ts";
import { handler as createMount, persist_created_mount_with_owner } from "../src/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import type { OwnerLocalMountRecordPersistencePort } from "../src/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import { handler as createMountSet, persist_created_mount_set_with_owner } from "../src/p2/consumer/external_capability_mounting/create_mount_set/handler.ts";
import type { OwnerLocalMountSetPersistencePort } from "../src/p2/consumer/external_capability_mounting/create_mount_set/handler.ts";
import { handler as activateMountSet, commit_active_mount_set_with_owner, recover_active_mount_set_with_owner } from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import type { OwnerLocalActiveMountSetPersistencePort } from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import { handler as realizeDependency, persist_dependency_realization_with_owner } from "../src/p2/consumer/p1_dependency_realization/realize_dependency/handler.ts";
import type { OwnerLocalDependencyBindingPersistencePort } from "../src/p2/consumer/p1_dependency_realization/realize_dependency/handler.ts";
import { handler as bindOperationUse } from "../src/p2/consumer/p1_dependency_realization/bind_operation_use/handler.ts";

export type JsonObject = Readonly<Record<string, unknown>>;
export const P2_CONSUMER_REALIZATION_SEQUENCE = Object.freeze([
  "consume_publication", "create_mount", "create_mount_set", "activate_mount_set", "realize_dependency", "bind_operation_use",
] as const);
export interface ReceivingP1DependencyBinding { readonly exact_owner_capability_ref:string; readonly exact_receiving_operation_ref:string; readonly exact_local_dependency_ref:string; }
export type P2ConsumerRealizationPersistence = OwnerLocalMountRecordPersistencePort & OwnerLocalMountSetPersistencePort & OwnerLocalActiveMountSetPersistencePort & OwnerLocalDependencyBindingPersistencePort;
export interface P2ConsumerDependencyRealizationInput { readonly publication:JsonObject; readonly verification:JsonObject; readonly receiving_domain_ref:string; readonly mount_policy?:JsonObject; readonly receiving_p1_binding:ReceivingP1DependencyBinding; readonly additional_retained_mounts?:readonly JsonObject[]; readonly current_active_mount_set?:JsonObject; readonly runtime_context?:JsonObject; readonly trace_id:string; readonly request_id:string; }
export interface P2ConsumerDependencyRecoveryInput { readonly receiving_domain_ref:string; readonly receiving_p1_binding:ReceivingP1DependencyBinding; readonly runtime_context?:JsonObject; readonly trace_id:string; readonly request_id:string; }
export interface P2ConsumerDependencyRealizationResult { readonly operation_sequence:typeof P2_CONSUMER_REALIZATION_SEQUENCE; readonly verified_publication:JsonObject; readonly mount:JsonObject; readonly mount_set:JsonObject; readonly active_mount_set:JsonObject; readonly dependency_realization_binding:JsonObject; readonly operation_use_binding:JsonObject; }
export interface P2ConsumerDependencyRecoveryResult { readonly active_mount_set:JsonObject; readonly dependency_realization_binding:JsonObject; readonly operation_use_binding:JsonObject; }
function text(v:unknown,f:string):string{if(typeof v!=="string"||!v)throw new TypeError(`${f} must be a non-empty exact identity`);return v;}
function object(v:unknown,f:string):JsonObject{if(v===null||typeof v!=="object"||Array.isArray(v))throw new TypeError(`${f} must be an object`);return v as JsonObject;}
function objects(v:unknown,f:string):readonly JsonObject[]{if(!Array.isArray(v)||v.length===0)throw new TypeError(`${f} must be a non-empty array`);return v.map((x,i)=>object(x,`${f}[${i}]`));}
function request(input:JsonObject,ctx:Readonly<{runtime_context?:JsonObject;trace_id:string;request_id:string}>){return Object.freeze({input,runtime_context:ctx.runtime_context??Object.freeze({}),trace_id:text(ctx.trace_id,"trace_id"),request_id:text(ctx.request_id,"request_id")});}
function receivingBinding(v:ReceivingP1DependencyBinding):Readonly<ReceivingP1DependencyBinding>{return Object.freeze({exact_owner_capability_ref:text(v.exact_owner_capability_ref,"receiving_p1_binding.exact_owner_capability_ref"),exact_receiving_operation_ref:text(v.exact_receiving_operation_ref,"receiving_p1_binding.exact_receiving_operation_ref"),exact_local_dependency_ref:text(v.exact_local_dependency_ref,"receiving_p1_binding.exact_local_dependency_ref")});}
function assertSelectedMount(active:JsonObject,provider:string,mount:JsonObject):void{const hash=text(mount.mount_hash,"mount.mount_hash"),members=objects(active.members,"active_mount_set.members"),matched=members.filter((m)=>m.provider_capability_contract_ref===provider&&m.mount_hash===hash);if(matched.length!==1)throw new TypeError("selected Provider Capability mount must be exactly one member of the active mount set");}
function assertDurable(binding:JsonObject,active:JsonObject,declared:Readonly<ReceivingP1DependencyBinding>):void{
  if(binding.exact_owner_capability_ref!==declared.exact_owner_capability_ref||binding.exact_receiving_operation_ref!==declared.exact_receiving_operation_ref||binding.exact_local_dependency_ref!==declared.exact_local_dependency_ref)throw new TypeError("durable dependency realization does not match the exact receiving-P1 declaration");
  if(binding.source_binding_kind!=="ACTIVE_MOUNT_SET_MEMBER")throw new TypeError("restart dependency recovery requires an ACTIVE_MOUNT_SET_MEMBER durable realization");
  const providerBinding=object(binding.verified_provider_binding_or_governed_data_binding,"dependency_realization_binding.verified_provider_binding_or_governed_data_binding"),activeHash=text(active.mount_set_hash,"active_mount_set.mount_set_hash");
  if(providerBinding.source_binding_kind!=="ACTIVE_MOUNT_SET_MEMBER"||providerBinding.active_mount_set_hash!==activeHash)throw new TypeError("durable dependency realization is not bound to the recovered current active mount set");
  const provider=text(providerBinding.provider_capability_contract_ref,"dependency_realization_binding.provider_capability_contract_ref"),selected=object(providerBinding.selected_mount,"dependency_realization_binding.selected_mount");assertSelectedMount(active,provider,selected);
  const recovered=objects(active.member_mounts,"active_mount_set.member_mounts"),selectedHash=text(selected.mount_hash,"dependency_realization_binding.selected_mount.mount_hash"),exact=recovered.filter((candidate)=>{if(candidate.mount_hash!==selectedHash)return false;const publication=object(candidate.verified_publication,"active_mount_set.member_mounts[].verified_publication");return publication.capability_contract_ref===provider;});
  if(exact.length!==1)throw new TypeError("durable dependency selected mount is not the exact recovered active mount member");
}
async function bindDurable(binding:JsonObject,declared:Readonly<ReceivingP1DependencyBinding>,ctx:Readonly<{runtime_context?:JsonObject;trace_id:string;request_id:string}>):Promise<JsonObject>{const use=await bindOperationUse(request(Object.freeze({dependency_realization_binding:binding,operation_use:Object.freeze({exact_receiving_operation_ref:declared.exact_receiving_operation_ref,exact_local_dependency_ref:declared.exact_local_dependency_ref})}),ctx));return object(use.runtime_result.operation_use_binding,"operation_use_binding");}

/** Non-semantic repository runtime support for Repository Skeleton V0137 / P2 V0124. */
export async function realizeP2ConsumerDependency(input:P2ConsumerDependencyRealizationInput,persistence:P2ConsumerRealizationPersistence):Promise<P2ConsumerDependencyRealizationResult>{
  const domain=text(input.receiving_domain_ref,"receiving_domain_ref"),declared=receivingBinding(input.receiving_p1_binding);
  const consumed=await consumePublication(request(Object.freeze({publication:input.publication,verification:input.verification}),input)),verified=object(consumed.runtime_result.verified_publication,"verified_publication");
  const mounted=await createMount(request(Object.freeze({verified_publication:verified,receiving_domain_ref:domain,mount_policy:input.mount_policy??Object.freeze({})}),input)),mount=object(mounted.runtime_result.mount,"mount");await persist_created_mount_with_owner(mount,persistence);
  const mounts=Object.freeze([...(input.additional_retained_mounts??Object.freeze([])),mount]),createdSet=await createMountSet(request(Object.freeze({receiving_domain_ref:domain,mounts}),input)),mountSet=object(createdSet.runtime_result.mount_set,"mount_set");await persist_created_mount_set_with_owner(mountSet,mounts,persistence);
  const activated=await activateMountSet(request(Object.freeze({mount_set:mountSet,...(input.current_active_mount_set===undefined?{}:{current_active_mount_set:input.current_active_mount_set})}),input)),active=object(activated.runtime_result.active_mount_set,"active_mount_set");await commit_active_mount_set_with_owner(active,persistence);
  const provider=text(verified.capability_contract_ref,"verified_publication.capability_contract_ref");assertSelectedMount(active,provider,mount);
  const dependency=await realizeDependency(request(Object.freeze({verified_provider_binding_or_governed_data_binding:Object.freeze({source_binding_kind:"ACTIVE_MOUNT_SET_MEMBER",active_mount_set_hash:active.mount_set_hash,provider_capability_contract_ref:provider,selected_mount:mount}),receiving_p1_binding:declared,create_p1_dependency:false}),input)),binding=object(dependency.runtime_result.dependency_realization_binding,"dependency_realization_binding");
  await persist_dependency_realization_with_owner(domain,binding,persistence);
  const operationUse=await bindDurable(binding,declared,input);
  return Object.freeze({operation_sequence:P2_CONSUMER_REALIZATION_SEQUENCE,verified_publication:verified,mount,mount_set:mountSet,active_mount_set:active,dependency_realization_binding:binding,operation_use_binding:operationUse});
}

/** Pointer-first restart recovery with exact five-field durable dependency key. */
export async function recoverP2ConsumerDependency(input:P2ConsumerDependencyRecoveryInput,persistence:P2ConsumerRealizationPersistence):Promise<P2ConsumerDependencyRecoveryResult>{
  const domain=text(input.receiving_domain_ref,"receiving_domain_ref"),declared=receivingBinding(input.receiving_p1_binding),active=await recover_active_mount_set_with_owner(domain,persistence),activeHash=text(active.mount_set_hash,"active_mount_set.mount_set_hash");
  const durable=await persistence.read_dependency_binding_record(Object.freeze({receiving_domain_ref:domain,exact_owner_capability_ref:declared.exact_owner_capability_ref,exact_receiving_operation_ref:declared.exact_receiving_operation_ref,exact_local_dependency_ref:declared.exact_local_dependency_ref,active_mount_set_hash:activeHash}));
  if(durable===undefined)throw new TypeError("exact durable dependency realization binding is missing for the recovered active mount set");
  assertDurable(durable,active,declared);const operationUse=await bindDurable(durable,declared,input);return Object.freeze({active_mount_set:active,dependency_realization_binding:durable,operation_use_binding:operationUse});
}
