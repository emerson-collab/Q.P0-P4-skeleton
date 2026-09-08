import assert from "node:assert/strict";
import { materializeRelationalSchema } from "../../../src/p1/materializer/materializer.ts";

const input={source_contract_ref:"Q.TEST.CONTRACT.CAPABILITY.SAMPLE@V0100",source_contract_hash:"sha256:"+"a".repeat(64),schema_name:"q_test",relational_semantics:{capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",entities:[
 {entity_ref:"project",owner_capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",fields:[{field_ref:"project.code",field_name:"project_code",semantic_type:"TEXT",required:true,identity:true},{field_ref:"project.title",field_name:"title",semantic_type:"TEXT",required:true}]},
 {entity_ref:"milestone",owner_capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",fields:[{field_ref:"milestone.code",field_name:"milestone_code",semantic_type:"TEXT",required:true,identity:true},{field_ref:"milestone.due",field_name:"due_date",semantic_type:"DATE",required:false}]},
 {entity_ref:"partner",owner_capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",fields:[{field_ref:"partner.code",field_name:"partner_code",semantic_type:"TEXT",required:true,identity:true}]}
],relations:[
 {relation_ref:"project_milestone",owner_capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",relation_kind:"ONE_TO_MANY",parent_entity_ref:"project",child_entity_ref:"milestone"},
 {relation_ref:"project_partner",owner_capability_ref:"Q.TEST.CAPABILITY.SAMPLE@V0100",relation_kind:"MANY_TO_MANY",left_entity_ref:"project",right_entity_ref:"partner"}
]}};
const plan=materializeRelationalSchema(input);
assert.equal(plan.tables.length,4);
assert.deepEqual(plan.tables.map(t=>t.table_name),["partner","project","milestone","project_partner"]);
const milestone=plan.tables.find(t=>t.table_name==="milestone")!;
assert.equal(milestone.foreign_keys[0]?.target_table,"project");
assert.equal(milestone.columns.find(c=>c.column_name==="due_date")?.data_type,"date");
const relation=plan.tables.find(t=>t.table_name==="project_partner")!;
assert.deepEqual(relation.unique_constraints.at(-1),["project_q_ref","partner_q_ref"]);
assert.match(plan.ordered_ddl.join("\n"),/FOREIGN KEY/);

const oneToOne=materializeRelationalSchema({source_contract_ref:"Q.TEST.CONTRACT.CAPABILITY.ONE@V0100",source_contract_hash:"sha256:"+"c".repeat(64),schema_name:"q_test",relational_semantics:{capability_ref:"Q.TEST.CAPABILITY.ONE@V0100",entities:[{entity_ref:"account",owner_capability_ref:"Q.TEST.CAPABILITY.ONE@V0100",fields:[{field_ref:"account.id",field_name:"account_id",semantic_type:"TEXT",required:true,identity:true}]},{entity_ref:"profile",owner_capability_ref:"Q.TEST.CAPABILITY.ONE@V0100",fields:[{field_ref:"profile.id",field_name:"profile_id",semantic_type:"TEXT",required:true,identity:true}]}],relations:[{relation_ref:"account_profile",owner_capability_ref:"Q.TEST.CAPABILITY.ONE@V0100",relation_kind:"ONE_TO_ONE",parent_entity_ref:"account",child_entity_ref:"profile"}]}});
const profile=oneToOne.tables.find(t=>t.table_name==="profile")!;assert.deepEqual(profile.unique_constraints.at(-1),["account_q_ref"]);assert.doesNotMatch(oneToOne.ordered_ddl.join("\n"),/REFERENCES[^,)]*\)[ ]+UNIQUE/);
console.log("relational_planner: PASS");
