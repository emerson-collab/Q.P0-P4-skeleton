import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  GOVERNED_DATA_MATERIAL_PROGRAM_REF,
  P1_BUSINESS_RUNTIME_REF,
  P1_CAPABILITY_MATERIALIZATION_REF,
  P2_CONTRACT_REF,
  REPOSITORY_SKELETON_REF,
  GovernedDataProviderRealizationError,
  realizeGovernedDataExposure,
  type GovernedDataCategory,
  type GovernedDataHandoffBinding,
  type GovernedDataMaterializationProgram,
  type SourceAccessKind,
} from "../../../runtime/governed_data_provider_realization.ts";

const CAPABILITY_CONTRACT_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OWNER_REF = "Q.TEST.CONTRACT.DOMAIN.EXAMPLE@V0100";
const SUBJECT_REF = "subject:example";
const INTEGRITY_REF = "Q.TEST.INTEGRITY.PROFILE@V0100";

function sourceKind(category: GovernedDataCategory): SourceAccessKind {
  if (category === "STATIC") return "P1_AUTHORIZED_STATIC_OR_PACKAGE_FACT";
  if (category === "DYNAMIC") return "AUTHORIZED_GOVERNED_STATE_OR_REGISTRY_FACT";
  return "ALREADY_PRODUCED_RUNTIME_FACT";
}

function handoff(category: GovernedDataCategory, kind = sourceKind(category)): GovernedDataHandoffBinding {
  return Object.freeze({
    binding_ref: `${CAPABILITY_CONTRACT_REF}#/p2_handoff/governed_data_exposure/${category.toLowerCase()}`,
    data_category: category,
    source_access_kind: kind,
    source_access_ref: `${CAPABILITY_CONTRACT_REF}#/sources/${category.toLowerCase()}`,
    members: Object.freeze([
      Object.freeze({
        member_ref: `member:${category.toLowerCase()}:1`,
        source_fact_ref: `${CAPABILITY_CONTRACT_REF}#/facts/${category.toLowerCase()}`,
        source_fact_authority_ref: OWNER_REF,
      }),
    ]),
  });
}

function p2Input(category: GovernedDataCategory) {
  const requested_representation = category === "STATIC"
    ? "INLINE_FACT_SET"
    : category === "DYNAMIC"
    ? "ARTIFACT_CHUNKED_SNAPSHOT"
    : "ARTIFACT_SNAPSHOT";
  return Object.freeze({
    source_domain_identity: OWNER_REF,
    subject_identity: SUBJECT_REF,
    source_provenance: Object.freeze({
      source_ref: `${CAPABILITY_CONTRACT_REF}#/facts/${category.toLowerCase()}`,
      revision_ref: `revision:${category.toLowerCase()}:1`,
    }),
    source_fact_authority: OWNER_REF,
    governed_access_binding: Object.freeze({ authorization_ref: "authorization:1" }),
    integrity_binding: Object.freeze({ profile_ref: INTEGRITY_REF }),
    authorized_exposure_request: Object.freeze({
      subject_ref: SUBJECT_REF,
      requested_representation,
      selection_spec: Object.freeze({ scope: "authorized" }),
    }),
    exact_source_authority: Object.freeze({ ref: OWNER_REF }),
    owning_persistence_contract: Object.freeze({ ref: `${OWNER_REF}#/persistence` }),
    integrity_profile: Object.freeze({ ref: INTEGRITY_REF }),
    artifact_store_binding: Object.freeze({ ref: "artifact-store:governed" }),
    ...(category === "RUNTIME" ? { reexecution_requested: false } : {}),
  });
}

function materializer(observed: GovernedDataCategory[]): GovernedDataMaterializationProgram {
  return Object.freeze({
    program_ref: GOVERNED_DATA_MATERIAL_PROGRAM_REF,
    async materialize_governed_data(input) {
      observed.push(input.data_category);
      const request = input.authorized_exposure_request as Readonly<Record<string, unknown>>;
      return Object.freeze({
        material_ref: `urn:q:material:${input.data_category.toLowerCase()}`,
        subject_ref: request.subject_ref,
        owner_ref: OWNER_REF,
        source_ref: `${CAPABILITY_CONTRACT_REF}#/facts/${input.data_category.toLowerCase()}`,
        representation_mode: request.requested_representation,
        content_hash: `sha256:${"a".repeat(64)}`,
        integrity_profile_ref: INTEGRITY_REF,
      });
    },
  });
}

function request(category: GovernedDataCategory) {
  return Object.freeze({
    capability_contract_ref: CAPABILITY_CONTRACT_REF,
    capability_contract_hash: `sha256:${"b".repeat(64)}`,
    governed_data_exposure_mode: "DECLARED" as const,
    handoff_binding: handoff(category),
    p2_operation_input: p2Input(category),
    runtime_context: Object.freeze({ stage_contract_ref: P2_CONTRACT_REF }),
    trace_id: `trace:${category.toLowerCase()}`,
    request_id: `request:${category.toLowerCase()}`,
  });
}

test("repository support dispatches explicit STATIC/DYNAMIC/RUNTIME bindings only through existing P2 exposure Operations", async () => {
  const observed: GovernedDataCategory[] = [];
  const expected = {
    STATIC: "expose_static_data",
    DYNAMIC: "expose_dynamic_data",
    RUNTIME: "expose_runtime_data",
  } as const;

  for (const category of ["STATIC", "DYNAMIC", "RUNTIME"] as const) {
    const result = await realizeGovernedDataExposure(request(category), materializer(observed));
    assert.equal(result.repository_support_ref, REPOSITORY_SKELETON_REF);
    assert.equal(result.p1_capability_materialization_ref, P1_CAPABILITY_MATERIALIZATION_REF);
    assert.equal(result.p1_business_runtime_ref, P1_BUSINESS_RUNTIME_REF);
    assert.equal(result.p2_contract_ref, P2_CONTRACT_REF);
    assert.equal(result.governed_data_material_program_ref, GOVERNED_DATA_MATERIAL_PROGRAM_REF);
    assert.equal(result.data_category, category);
    assert.equal(result.p2_operation_id, expected[category]);
    assert.equal(result.p2_runtime_result.data_category, category);
    assert.equal(
      (result.p2_runtime_result.material_envelope as Readonly<Record<string, unknown>>).subject_ref,
      SUBJECT_REF,
    );
  }

  assert.deepEqual(observed, ["STATIC", "DYNAMIC", "RUNTIME"]);
});

test("repository support does not execute undeclared governed-data exposure", async () => {
  const input = { ...request("STATIC"), governed_data_exposure_mode: "NONE" } as unknown as Parameters<
    typeof realizeGovernedDataExposure
  >[0];
  await assert.rejects(
    () => realizeGovernedDataExposure(input, materializer([])),
    (error: unknown) =>
      error instanceof GovernedDataProviderRealizationError
      && error.code === "RDS_GOVERNED_DATA_NOT_DECLARED",
  );
});

test("explicit category cannot be paired with a forbidden P1 source-access kind", async () => {
  const input = {
    ...request("STATIC"),
    handoff_binding: handoff("STATIC", "ALREADY_PRODUCED_RUNTIME_FACT"),
  };
  await assert.rejects(
    () => realizeGovernedDataExposure(input, materializer([])),
    (error: unknown) =>
      error instanceof GovernedDataProviderRealizationError
      && error.code === "RDS_GOVERNED_DATA_SOURCE_ACCESS_INVALID",
  );
});

test("DECLARED_Q_INTERFACE_SOURCE_FACT requires pre-resolved P1 V0184 anchor binding evidence", async () => {
  const missing = {
    ...request("DYNAMIC"),
    handoff_binding: handoff("DYNAMIC", "DECLARED_Q_INTERFACE_SOURCE_FACT"),
  };
  await assert.rejects(
    () => realizeGovernedDataExposure(missing, materializer([])),
    /p1_interface_anchor_binding_ref must be a non-empty string/,
  );

  const resolved = {
    ...missing,
    p1_interface_anchor_binding_ref:
      `${P1_BUSINESS_RUNTIME_REF}#/concrete_interface_framework_anchor_crosswalk/anchors/CALL_INVOKE`,
  };
  const result = await realizeGovernedDataExposure(resolved, materializer([]));
  assert.equal(result.data_category, "DYNAMIC");
});

test("materialize_governed_data must be the exact CURRENT GDM V0104 program binding", async () => {
  const invalid = {
    ...materializer([]),
    program_ref: "Q.TEST.GDM@V0100#/provider_materialization_program",
  } as unknown as GovernedDataMaterializationProgram;
  await assert.rejects(
    () => realizeGovernedDataExposure(request("STATIC"), invalid),
    (error: unknown) =>
      error instanceof GovernedDataProviderRealizationError
      && error.code === "RDS_GOVERNED_DATA_MATERIALIZER_INVALID",
  );
});

test("RUNTIME exposure cannot re-execute P1 solely to manufacture data", async () => {
  const input = {
    ...request("RUNTIME"),
    p2_operation_input: Object.freeze({
      ...p2Input("RUNTIME"),
      reexecution_requested: true,
    }),
  };
  await assert.rejects(
    () => realizeGovernedDataExposure(input, materializer([])),
    (error: unknown) =>
      error instanceof GovernedDataProviderRealizationError
      && error.code === "RDS_GOVERNED_DATA_RUNTIME_REEXECUTION_FORBIDDEN",
  );
});

test("obsolete governed-data helper layer is absent", () => {
  assert.equal(existsSync("runtime/p2_governed_data_material_projection.ts"), false);
  assert.equal(existsSync("runtime/p2_google_drive_material_store.ts"), false);
});
