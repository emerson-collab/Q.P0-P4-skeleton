import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/rollback_mount/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({ input, runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF }, trace_id: "trace-p2", request_id: "request-p2" });
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; return Object.fromEntries(Object.keys(source).sort().map((key) => [key, stable(source[key])])); } return value; }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")}`; }
const resolverPayload = Object.freeze({ publication_hash: `sha256:${"c".repeat(64)}`, implementation_artifact_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100#/physical_model", implementation_artifact_hash: `sha256:${"d".repeat(64)}`, provider_neutral_locator_binding: Object.freeze({ material_path: "export/search/entry.ts" }), entry_symbol_ref: "export/search/entry.ts#entry", local_material_binding_ref: "local-material:search-v0100" });
const resolverState = Object.freeze({ ...resolverPayload, binding_hash: sha256Json(resolverPayload), verified: true });
const activeMount = Object.freeze({ mount_hash: `sha256:${"a".repeat(64)}`, status: "ACTIVE", verified_publication: { verified: true }, resolver_state: resolverState });
const rollbackTargetMount = Object.freeze({ mount_hash: `sha256:${"b".repeat(64)}`, status: "INACTIVE", verified_publication: { verified: true }, resolver_state: resolverState });

test("rollback_mount preserves verified V0117 resolver_state on the rollback target", async () => { const response = await handler(baseRequest({ active_mount: activeMount, rollback_target_mount: rollbackTargetMount })); const rolledBack = response.runtime_result.active_mount as Readonly<Record<string, unknown>>; assert.equal(response.outcome_type, "response"); assert.equal(rolledBack.status, "ACTIVE"); assert.equal(rolledBack.mount_hash, rollbackTargetMount.mount_hash); assert.equal(rolledBack.rolled_back_from_mount_hash, activeMount.mount_hash); assert.deepEqual(rolledBack.resolver_state, resolverState); });

test("rollback_mount fails closed when rollback resolver_state is altered", async () => { await assert.rejects(() => handler(baseRequest({ active_mount: activeMount, rollback_target_mount: { ...rollbackTargetMount, resolver_state: { ...resolverState, binding_hash: `sha256:${"e".repeat(64)}` } } })), (error: unknown) => error instanceof P2StableError && error.code === "P2_INTEGRITY_BINDING_INVALID"); });
