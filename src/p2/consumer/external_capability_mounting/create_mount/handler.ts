import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface P2OperationRequest {
  readonly input: JsonObject;
  readonly runtime_context: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2OperationResponse {
  readonly outcome_type: "response";
  readonly runtime_result: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export class P2StableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "P2StableError";
    this.code = code;
  }
}

function objectValue(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be an object`);
  }
  return value as JsonObject;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be a non-empty string`);
  }
  return value;
}

function sha256Value(value: unknown, field: string): string {
  const text = stringValue(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", `${field} must be an exact sha256 binding`);
  }
  return text;
}

function arrayValue(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be an array`);
  }
  return value;
}

function optionalObject(value: unknown, field: string): JsonObject | undefined {
  if (value === undefined) return undefined;
  return objectValue(value, field);
}

function optionalArray(value: unknown, field: string): readonly unknown[] | undefined {
  if (value === undefined) return undefined;
  return arrayValue(value, field);
}

function boolValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be boolean`);
  }
  return value;
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(stableClone));
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]);
    return Object.freeze(out);
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(stableClone(value));
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function success(request: P2OperationRequest, runtime_result: JsonObject): P2OperationResponse {
  return Object.freeze({
    outcome_type: "response" as const,
    runtime_result: Object.freeze({ ...runtime_result }),
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
}

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0118" as const;

export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "create_mount" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const verified_publication = objectValue(request.input.verified_publication, "verified_publication");
  if (verified_publication.verified !== true) throw new P2StableError("P2_PUBLICATION_NOT_VERIFIED", "verified publication required");
  const resolver_state = objectValue(verified_publication.resolver_state, "verified_publication.resolver_state");
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "verified resolver state required");
  const implementation_binding_hash = sha256Value(
    resolver_state.implementation_binding_hash,
    "verified_publication.resolver_state.implementation_binding_hash",
  );
  objectValue(resolver_state.implementation_material_binding, "verified_publication.resolver_state.implementation_material_binding");
  const receiving_domain_ref = stringValue(request.input.receiving_domain_ref, "receiving_domain_ref");
  const publication_hash = sha256Value(verified_publication.publication_hash, "verified_publication.publication_hash");
  const mount_policy = optionalObject(request.input.mount_policy, "mount_policy") ?? Object.freeze({});
  const identity_payload = stableClone({ receiving_domain_ref, publication_hash, implementation_binding_hash, mount_policy });
  return success(request, {
    result_kind: "MOUNT",
    mount: Object.freeze({
      receiving_domain_ref,
      publication_hash,
      verified_publication: stableClone(verified_publication),
      resolver_state: stableClone(resolver_state),
      implementation_binding_hash,
      mount_policy: stableClone(mount_policy),
      mount_hash: sha256Json(identity_payload),
      status: "INACTIVE",
      active_pointer_owned: false,
    }),
  });
}

export interface OwnerLocalMountRecordPersistencePort {
  persist_mount_record(input: Readonly<{
    receiving_domain_ref: string;
    mount_hash: string;
    mount: JsonObject;
  }>): Promise<void>;

  read_mount_record(input: Readonly<{
    receiving_domain_ref: string;
    mount_hash: string;
  }>): Promise<JsonObject | undefined>;
}

function persistenceMountIdentity(
  mount: JsonObject,
): Readonly<{
  receiving_domain_ref: string;
  publication_hash: string;
  implementation_binding_hash: string;
  mount_hash: string;
}> {
  const receiving_domain_ref = stringValue(
    mount.receiving_domain_ref,
    "mount.receiving_domain_ref",
  );

  const publication_hash = sha256Value(
    mount.publication_hash,
    "mount.publication_hash",
  );

  const verified_publication = objectValue(
    mount.verified_publication,
    "mount.verified_publication",
  );

  if (verified_publication.verified !== true) {
    throw new P2StableError(
      "P2_MOUNT_NOT_VERIFIED",
      "mount publication must remain verified",
    );
  }

  const resolver_state = objectValue(
    mount.resolver_state,
    "mount.resolver_state",
  );

  if (resolver_state.verified !== true) {
    throw new P2StableError(
      "P2_RESOLVER_STATE_NOT_VERIFIED",
      "mount resolver state must remain verified",
    );
  }

  const implementation_binding_hash = sha256Value(
    mount.implementation_binding_hash,
    "mount.implementation_binding_hash",
  );

  const resolver_binding_hash = sha256Value(
    resolver_state.implementation_binding_hash,
    "mount.resolver_state.implementation_binding_hash",
  );

  if (implementation_binding_hash !== resolver_binding_hash) {
    throw new P2StableError(
      "P2_IMPLEMENTATION_BINDING_HASH_MISMATCH",
      "mount and resolver state must preserve the same implementation binding",
    );
  }

  const mount_policy =
    optionalObject(
      mount.mount_policy,
      "mount.mount_policy",
    ) ?? Object.freeze({});

  const mount_hash = sha256Value(
    mount.mount_hash,
    "mount.mount_hash",
  );

  const expected_mount_hash = sha256Json(
    stableClone({
      receiving_domain_ref,
      publication_hash,
      implementation_binding_hash,
      mount_policy,
    }),
  );

  if (mount_hash !== expected_mount_hash) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "mount_hash does not preserve exact create_mount identity",
    );
  }

  return Object.freeze({
    receiving_domain_ref,
    publication_hash,
    implementation_binding_hash,
    mount_hash,
  });
}

export async function persist_created_mount_with_owner(
  mount: JsonObject,
  persistence: OwnerLocalMountRecordPersistencePort,
): Promise<void> {
  if (mount.status !== "INACTIVE") {
    throw new P2StableError(
      "P2_INVALID_INPUT",
      "only an exact INACTIVE create_mount result may be durably retained",
    );
  }

  const identity =
    persistenceMountIdentity(mount);

  await persistence.persist_mount_record(
    Object.freeze({
      receiving_domain_ref:
        identity.receiving_domain_ref,
      mount_hash:
        identity.mount_hash,
      mount:
        stableClone(mount) as JsonObject,
    }),
  );

  const readback =
    await persistence.read_mount_record(
      Object.freeze({
        receiving_domain_ref:
          identity.receiving_domain_ref,
        mount_hash:
          identity.mount_hash,
      }),
    );

  if (
    readback === undefined ||
    canonical(readback) !== canonical(mount)
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "owner-local mount record exact read-back failed",
    );
  }
}
