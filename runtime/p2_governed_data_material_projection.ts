import { deep_freeze } from "../src/p0/runtime_contract.ts";
import type {
  JsonObject,
  P2GovernedDataCategory,
  P2GoogleDriveMaterialStore,
  P2GoogleDriveStoredMaterial,
} from "./p2_google_drive_material_store.ts";

export interface P1GovernedDataProjectionInput {
  readonly data_category: P2GovernedDataCategory;
  readonly material_ref: string;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly source_ref: string;
  readonly source_provenance: JsonObject;
  readonly source_fact_authority: string;
  readonly selection_spec: JsonObject;
  readonly integrity_profile_ref: string;
  readonly exact_json_material: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2GovernedDataMaterialSetMember {
  readonly data_category: P2GovernedDataCategory;
  readonly source_provenance: JsonObject;
  readonly source_fact_authority: string;
  readonly selection_spec: JsonObject;
  readonly material_envelope: Readonly<{
    material_ref: string;
    subject_ref: string;
    owner_ref: string;
    source_ref: string;
    representation_mode: "ARTIFACT_SNAPSHOT";
    content_hash: string;
    integrity_profile_ref: string;
  }>;
}

export interface P1GovernedDataProjectionResult {
  readonly material_set_member: P2GovernedDataMaterialSetMember;
  readonly stored_material: P2GoogleDriveStoredMaterial;
}

const DATA_CATEGORIES = Object.freeze([
  "STATIC",
  "DYNAMIC",
  "RUNTIME",
] as const);

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function jsonObject(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as JsonObject;
}

function exactDataCategory(value: unknown): P2GovernedDataCategory {
  if (!(DATA_CATEGORIES as readonly unknown[]).includes(value)) {
    throw new TypeError("data_category must be explicitly STATIC, DYNAMIC, or RUNTIME");
  }
  return value as P2GovernedDataCategory;
}

/**
 * Repository-support projection from one already-governed P1 data result into
 * one existing P2 governed-data category material.
 *
 * Category and selection authority are inputs. This projection never infers a
 * category from field names, source code, runtime values, repository paths, or
 * material contents. It writes only through the existing P2 Google Drive
 * material store and returns a material-set member consumable by the existing
 * P2 create_material_set operation.
 */
export async function projectP1GovernedDataToP2Material(
  input: Readonly<P1GovernedDataProjectionInput>,
  store: P2GoogleDriveMaterialStore,
): Promise<P1GovernedDataProjectionResult> {
  const dataCategory = exactDataCategory(input.data_category);
  const materialRef = nonEmptyString(input.material_ref, "material_ref");
  const ownerRef = nonEmptyString(input.owner_ref, "owner_ref");
  const subjectRef = nonEmptyString(input.subject_ref, "subject_ref");
  const sourceRef = nonEmptyString(input.source_ref, "source_ref");
  const sourceProvenance = jsonObject(input.source_provenance, "source_provenance");
  const sourceFactAuthority = nonEmptyString(
    input.source_fact_authority,
    "source_fact_authority",
  );
  const selectionSpec = jsonObject(input.selection_spec, "selection_spec");
  const integrityProfileRef = nonEmptyString(
    input.integrity_profile_ref,
    "integrity_profile_ref",
  );
  const exactJsonMaterial = jsonObject(input.exact_json_material, "exact_json_material");
  const traceId = nonEmptyString(input.trace_id, "trace_id");
  const requestId = nonEmptyString(input.request_id, "request_id");

  const storedMaterial = await store.writeJsonObject({
    owner_ref: ownerRef,
    subject_ref: subjectRef,
    data_category: dataCategory,
    material: exactJsonMaterial,
    trace_id: traceId,
    request_id: requestId,
  });

  if (storedMaterial.locator.data_category !== dataCategory) {
    throw new TypeError("stored material category does not match explicit data_category");
  }

  const materialSetMember = deep_freeze({
    data_category: dataCategory,
    source_provenance: { ...sourceProvenance },
    source_fact_authority: sourceFactAuthority,
    selection_spec: { ...selectionSpec },
    material_envelope: {
      material_ref: materialRef,
      subject_ref: subjectRef,
      owner_ref: ownerRef,
      source_ref: sourceRef,
      representation_mode: "ARTIFACT_SNAPSHOT" as const,
      content_hash: storedMaterial.locator.content_hash,
      integrity_profile_ref: integrityProfileRef,
    },
  } satisfies P2GovernedDataMaterialSetMember);

  return Object.freeze({
    material_set_member: materialSetMember,
    stored_material: storedMaterial,
  });
}
