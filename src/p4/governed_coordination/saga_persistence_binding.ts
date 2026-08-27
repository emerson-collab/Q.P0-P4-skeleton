export interface SnapshotParticipant { snapshot():unknown; restore(snapshot:unknown):void; }
export interface SagaPersistenceBinding { readonly profile:string; readonly restart_safe:boolean; readonly crash_safe:boolean; runAtomic<T>(fn:()=>Promise<T>):Promise<T>; }
export class ReferenceInMemorySagaPersistenceBinding implements SagaPersistenceBinding {
 readonly profile="REFERENCE_IN_MEMORY" as const; readonly restart_safe=false; readonly crash_safe=false;
 private readonly participants=new Set<SnapshotParticipant>(); private tail:Promise<void>=Promise.resolve();
 register(p:SnapshotParticipant):void{this.participants.add(p);}
 async runAtomic<T>(fn:()=>Promise<T>):Promise<T>{let release!:()=>void;const prev=this.tail;this.tail=new Promise<void>(r=>release=r);await prev;const snaps=[...this.participants].map(p=>[p,p.snapshot()] as const);try{return await fn();}catch(e){for(const [p,s] of snaps)p.restore(s);throw e;}finally{release();}}
}
export function assertProductionPersistence(binding:SagaPersistenceBinding):void{if(binding.profile==="REFERENCE_IN_MEMORY"||!binding.restart_safe||!binding.crash_safe)throw new Error("P4 production profile requires restart-safe crash-safe persistence binding");}
