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

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;

export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "activate_mount" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const mount = objectValue(request.input.mount, "mount");
  const mount_hash = sha256Value(mount.mount_hash, "mount.mount_hash");
  const verified_publication = objectValue(mount.verified_publication, "mount.verified_publication");
  if (verified_publication.verified !== true) throw new P2StableError("P2_MOUNT_NOT_VERIFIED", "mount publication must be verified before activation");
  const resolver_state = objectValue(mount.resolver_state, "mount.resolver_state");
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "mount resolver state must remain verified");
  const implementation_binding_hash = sha256Value(mount.implementation_binding_hash, "mount.implementation_binding_hash");
  const resolver_binding_hash = sha256Value(resolver_state.implementation_binding_hash, "mount.resolver_state.implementation_binding_hash");
  if (implementation_binding_hash !== resolver_binding_hash) {
    throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "mount and resolver state must preserve the same implementation binding");
  }
  const current_active_mount = optionalObject(request.input.current_active_mount, "current_active_mount");
  return success(request, {
    result_kind: "ACTIVE_MOUNT",
    active_mount: Object.freeze({
      ...stableClone(mount) as JsonObject,
      mount_hash,
      resolver_state: stableClone(resolver_state),
      implementation_binding_hash,
      status: "ACTIVE",
      previous_active_mount: stableClone(current_active_mount),
      activation_order: "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST",
    }),
  });
}

export interface OwnerLocalActiveMountPersistencePort {
  read_mount_record(input: Readonly<{
    receiving_domain_ref: string;
    mount_hash: string;
  }>): Promise<JsonObject | undefined>;

  reverify_implementation_material(input: Readonly<{
    receiving_domain_ref: string;
    mount_hash: string;
    implementation_binding_hash: string;
    resolver_state: JsonObject;
  }>): Promise<void>;

  read_active_pointer(input: Readonly<{
    receiving_domain_ref: string;
  }>): Promise<JsonObject | undefined>;

  switch_active_pointer(input: Readonly<{
    receiving_domain_ref: string;
    mount_hash: string;
    previous_active_pointer?: JsonObject;
  }>): Promise<void>;
}

function persistenceActiveMountIdentity(
  mount: JsonObject,
): Readonly<{
  receiving_domain_ref: string;
  publication_hash: string;
  implementation_binding_hash: string;
  mount_hash: string;
  resolver_state: JsonObject;
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
    resolver_state,
  });
}

function persistenceActivePointerIdentity(
  pointer: JsonObject,
): Readonly<{
  receiving_domain_ref: string;
  mount_hash: string;
}> {
  return Object.freeze({
    receiving_domain_ref:
      stringValue(
        pointer.receiving_domain_ref,
        "active_pointer.receiving_domain_ref",
      ),

    mount_hash:
      sha256Value(
        pointer.mount_hash,
        "active_pointer.mount_hash",
      ),
  });
}

export async function commit_active_mount_with_owner(
  active_mount: JsonObject,
  persistence: OwnerLocalActiveMountPersistencePort,
): Promise<void> {
  if (active_mount.status !== "ACTIVE") {
    throw new P2StableError(
      "P2_MOUNT_NOT_ACTIVE",
      "exact ACTIVE mount required before pointer commit",
    );
  }

  const active =
    persistenceActiveMountIdentity(
      active_mount,
    );

  const retained =
    await persistence.read_mount_record(
      Object.freeze({
        receiving_domain_ref:
          active.receiving_domain_ref,
        mount_hash:
          active.mount_hash,
      }),
    );

  if (retained === undefined) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "exact retained owner-local mount record is required",
    );
  }

  if (retained.status !== "INACTIVE") {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "retained owner-local mount record must remain immutable INACTIVE material",
    );
  }

  const retainedIdentity =
    persistenceActiveMountIdentity(
      retained,
    );

  if (
    retainedIdentity.receiving_domain_ref !==
      active.receiving_domain_ref ||
    retainedIdentity.publication_hash !==
      active.publication_hash ||
    retainedIdentity.implementation_binding_hash !==
      active.implementation_binding_hash ||
    retainedIdentity.mount_hash !==
      active.mount_hash
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active mount does not match exact retained mount identity",
    );
  }

  if (
    canonical(retained.verified_publication) !==
      canonical(active_mount.verified_publication) ||
    canonical(retained.resolver_state) !==
      canonical(active_mount.resolver_state)
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active mount publication/resolver material differs from retained mount",
    );
  }

  // Exact material verification BEFORE pointer mutation.
  await persistence.reverify_implementation_material(
    Object.freeze({
      receiving_domain_ref:
        active.receiving_domain_ref,
      mount_hash:
        active.mount_hash,
      implementation_binding_hash:
        active.implementation_binding_hash,
      resolver_state:
        stableClone(
          active.resolver_state,
        ) as JsonObject,
    }),
  );

  const previous_active_pointer =
    await persistence.read_active_pointer(
      Object.freeze({
        receiving_domain_ref:
          active.receiving_domain_ref,
      }),
    );

  // Atomic pointer mutation LAST.
  await persistence.switch_active_pointer(
    Object.freeze({
      receiving_domain_ref:
        active.receiving_domain_ref,
      mount_hash:
        active.mount_hash,

      ...(
        previous_active_pointer === undefined
          ? {}
          : {
              previous_active_pointer:
                stableClone(
                  previous_active_pointer,
                ) as JsonObject,
            }
      ),
    }),
  );

  const readback =
    await persistence.read_active_pointer(
      Object.freeze({
        receiving_domain_ref:
          active.receiving_domain_ref,
      }),
    );

  if (readback === undefined) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active pointer read-back is missing",
    );
  }

  const pointer =
    persistenceActivePointerIdentity(
      readback,
    );

  if (
    pointer.receiving_domain_ref !==
      active.receiving_domain_ref ||
    pointer.mount_hash !==
      active.mount_hash
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active pointer does not reference exact activated mount",
    );
  }
}

export async function recover_active_mount_with_owner(
  receiving_domain_ref: string,
  persistence: OwnerLocalActiveMountPersistencePort,
): Promise<JsonObject> {
  const domain_ref =
    stringValue(
      receiving_domain_ref,
      "receiving_domain_ref",
    );

  // Restart recovery: pointer FIRST.
  const pointerValue =
    await persistence.read_active_pointer(
      Object.freeze({
        receiving_domain_ref:
          domain_ref,
      }),
    );

  if (pointerValue === undefined) {
    throw new P2StableError(
      "P2_MOUNT_NOT_ACTIVE",
      "owner-local active pointer is missing",
    );
  }

  const pointer =
    persistenceActivePointerIdentity(
      pointerValue,
    );

  if (
    pointer.receiving_domain_ref !==
      domain_ref
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active pointer receiving Domain mismatch",
    );
  }

  const retained =
    await persistence.read_mount_record(
      Object.freeze({
        receiving_domain_ref:
          domain_ref,
        mount_hash:
          pointer.mount_hash,
      }),
    );

  if (retained === undefined) {
    throw new P2StableError(
      "P2_MOUNT_NOT_ACTIVE",
      "exact retained mount record is missing",
    );
  }

  if (retained.status !== "INACTIVE") {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "retained mount record must remain immutable INACTIVE material",
    );
  }

  const identity =
    persistenceActiveMountIdentity(
      retained,
    );

  if (
    identity.receiving_domain_ref !==
      domain_ref ||
    identity.mount_hash !==
      pointer.mount_hash
  ) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "active pointer and retained mount identity mismatch",
    );
  }

  await persistence.reverify_implementation_material(
    Object.freeze({
      receiving_domain_ref:
        identity.receiving_domain_ref,
      mount_hash:
        identity.mount_hash,
      implementation_binding_hash:
        identity.implementation_binding_hash,
      resolver_state:
        stableClone(
          identity.resolver_state,
        ) as JsonObject,
    }),
  );

  return Object.freeze({
    ...stableClone(retained) as JsonObject,
    status: "ACTIVE",
    activation_order:
      "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST",
  });
}
