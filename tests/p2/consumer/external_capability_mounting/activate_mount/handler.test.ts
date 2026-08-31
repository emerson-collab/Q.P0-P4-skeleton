import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/activate_mount/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({ input, runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF }, trace_id: "trace-p2", request_id: "request-p2" });
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; return Object.fromEntries(Object.keys(source).sort().map((key) => [key, stable(source[key])])); } return value; }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")}`; }
const resolverPayload = Object.freeze({ publication_hash: `sha256:${"c".repeat(64)}`, implementation_artifact_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100#/physical_model", implementation_artifact_hash: `sha256:${"d".repeat(64)}`, provider_neutral_locator_binding: Object.freeze({ material_path: "export/search/entry.ts" }), entry_symbol_ref: "export/search/entry.ts#entry", local_material_binding_ref: "local-material:search-v0100" });
const resolverState = Object.freeze({ ...resolverPayload, binding_hash: sha256Json(resolverPayload), verified: true });
const mount = Object.freeze({ mount_hash: `sha256:${"b".repeat(64)}`, status: "INACTIVE", verified_publication: { verified: true, publication_hash: resolverPayload.publication_hash }, resolver_state: resolverState });

test("activate_mount preserves exact verified V0117 resolver_state", async () => { const response = await handler(baseRequest({ mount })); const activeMount = response.runtime_result.active_mount as Readonly<Record<string, unknown>>; assert.equal(response.outcome_type, "response"); assert.equal(activeMount.status, "ACTIVE"); assert.equal(activeMount.mount_hash, mount.mount_hash); assert.deepEqual(activeMount.resolver_state, resolverState); assert.equal(activeMount.activation_order, "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST"); });

test("activate_mount fails closed when resolver_state integrity is invalid", async () => { await assert.rejects(() => handler(baseRequest({ mount: { ...mount, resolver_state: { ...resolverState, binding_hash: `sha256:${"e".repeat(64)}` } } })), (error: unknown) => error instanceof P2StableError && error.code === "P2_INTEGRITY_BINDING_INVALID"); });
