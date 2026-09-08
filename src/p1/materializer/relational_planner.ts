import { MaterializerError, sha256Canonical, type RelationalMaterializerInput, type RelationalSchemaPlan, type RelationalTablePlan, type RelationalColumnPlan, type RelationalForeignKeyPlan, type RelationalFieldSemantic } from "./relational_ir.ts";

const SQL_TYPE: Record<RelationalFieldSemantic["semantic_type"], string> = {
  TEXT:"text", INTEGER:"bigint", NUMBER:"double precision", BOOLEAN:"boolean", DATE:"date", DATETIME:"timestamptz", JSON:"jsonb",
};
const qid = (v:string) => `"${v.replaceAll('"','""')}"`;
const COMMON_COLUMNS: readonly RelationalColumnPlan[] = Object.freeze([
  Object.freeze({column_name:"q_ref",data_type:"text",nullable:false,framework_owned:true}),
  Object.freeze({column_name:"q_revision",data_type:"bigint",nullable:false,framework_owned:true}),
  Object.freeze({column_name:"q_created_at",data_type:"timestamptz",nullable:false,framework_owned:true}),
  Object.freeze({column_name:"q_updated_at",data_type:"timestamptz",nullable:false,framework_owned:true}),
]);

function columnFor(field: RelationalFieldSemantic): RelationalColumnPlan {
  return Object.freeze({column_name:field.field_name,data_type:SQL_TYPE[field.semantic_type],nullable:!field.required,business_field_ref:field.field_ref});
}
function ddl(schema:string, table:RelationalTablePlan):string {
  const parts:string[]=[];
  for(const c of table.columns){
    let x=`${qid(c.column_name)} ${c.data_type}`;
    if(!c.nullable)x+=' NOT NULL';
    if(c.column_name==='q_ref')x+=' PRIMARY KEY';
    parts.push(x);
  }
  for(const u of table.unique_constraints) parts.push(`UNIQUE (${u.map(qid).join(', ')})`);
  for(const fk of table.foreign_keys) parts.push(`FOREIGN KEY (${qid(fk.column_name)}) REFERENCES ${qid(schema)}.${qid(fk.target_table)} (${qid(fk.target_column)})`);
  return `CREATE TABLE IF NOT EXISTS ${qid(schema)}.${qid(table.table_name)} (${parts.join(', ')});`;
}

export function planRelationalSchema(input: RelationalMaterializerInput): RelationalSchemaPlan {
  const model=input.relational_semantics;
  const tables=new Map<string,RelationalTablePlan>();
  for(const entity of [...model.entities].sort((a,b)=>a.entity_ref.localeCompare(b.entity_ref))){
    const identities=entity.fields.filter(f=>f.identity===true).map(f=>f.field_name).sort();
    const cols=[...COMMON_COLUMNS,...entity.fields.map(columnFor)];
    tables.set(entity.entity_ref,Object.freeze({table_name:entity.entity_ref,owner_capability_ref:model.capability_ref,source_semantic_ref:entity.entity_ref,table_kind:"ENTITY" as const,columns:Object.freeze(cols),business_identity_columns:Object.freeze(identities),foreign_keys:Object.freeze([]),unique_constraints:Object.freeze(identities.length?[Object.freeze(identities)]:[])}));
  }
  const replaceTable=(name:string, next:RelationalTablePlan)=>tables.set(name,Object.freeze(next));
  for(const r of [...model.relations].sort((a,b)=>a.relation_ref.localeCompare(b.relation_ref))){
    if(r.relation_kind==='MANY_TO_MANY'){
      const left=r.left_entity_ref!, right=r.right_entity_ref!;
      if(tables.has(r.relation_ref)) throw new MaterializerError("P1_MATERIALIZER_TABLE_COLLISION", r.relation_ref);
      const lc=`${left}_q_ref`, rc=`${right}_q_ref`;
      const fks:RelationalForeignKeyPlan[]=[Object.freeze({column_name:lc,target_table:left,target_column:"q_ref",unique:false}),Object.freeze({column_name:rc,target_table:right,target_column:"q_ref",unique:false})];
      const cols=[...COMMON_COLUMNS,Object.freeze({column_name:lc,data_type:"text",nullable:false}),Object.freeze({column_name:rc,data_type:"text",nullable:false})];
      tables.set(r.relation_ref,Object.freeze({table_name:r.relation_ref,owner_capability_ref:model.capability_ref,source_semantic_ref:r.relation_ref,table_kind:"RELATION" as const,columns:Object.freeze(cols),business_identity_columns:Object.freeze([]),foreign_keys:Object.freeze(fks),unique_constraints:Object.freeze([Object.freeze([lc,rc])])}));
      continue;
    }
    const parent=r.parent_entity_ref!, child=r.child_entity_ref!;
    const childTable=tables.get(child); if(!childTable) throw new MaterializerError("P1_MATERIALIZER_RELATION_ENDPOINT_UNRESOLVED", child);
    const col=`${parent}_q_ref`;
    if(childTable.columns.some(c=>c.column_name===col)) throw new MaterializerError("P1_MATERIALIZER_FIELD_COLLISION", `${child}.${col}`);
    const fk:Object = Object.freeze({column_name:col,target_table:parent,target_column:"q_ref",unique:r.relation_kind==='ONE_TO_ONE'});
    replaceTable(child,{...childTable,columns:Object.freeze([...childTable.columns,Object.freeze({column_name:col,data_type:"text",nullable:false})]),foreign_keys:Object.freeze([...childTable.foreign_keys,fk as RelationalForeignKeyPlan]),unique_constraints:Object.freeze(r.relation_kind==='ONE_TO_ONE'?[...childTable.unique_constraints,Object.freeze([col])]:[...childTable.unique_constraints])});
  }
  // deterministic topological order; relation tables naturally depend on endpoints
  const remaining=new Map(tables); const ordered:RelationalTablePlan[]=[];
  while(remaining.size){
    const ready=[...remaining.values()].filter(t=>t.foreign_keys.every(f=>!remaining.has(f.target_table))).sort((a,b)=>a.table_name.localeCompare(b.table_name));
    if(!ready.length) throw new MaterializerError("P1_MATERIALIZER_RELATION_CYCLE", "foreign-key dependency cycle");
    for(const t of ready){ordered.push(t);remaining.delete(t.table_name);}
  }
  const body={representation_version:"P1_RELATIONAL_SCHEMA_PLAN_V1" as const,source_contract_ref:input.source_contract_ref,source_contract_hash:input.source_contract_hash,capability_ref:model.capability_ref,schema_name:input.schema_name,tables:Object.freeze(ordered),ordered_ddl:Object.freeze(ordered.map(t=>ddl(input.schema_name,t)))};
  return Object.freeze({...body,content_hash:sha256Canonical(body)});
}
