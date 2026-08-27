import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/create_mount/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("create_mount materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({ verified_publication: {
  verified: true,
  publication_hash: `sha256:${"b".repeat(64)}`,
  publication: { immutable: true },
}, receiving_domain_ref: "Q.RECEIVER.CONTRACT.DOMAIN@V0100", mount_policy: { mode: "PINNED" } }));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("create_mount fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ verified_publication: { verified: false }, receiving_domain_ref: "Q.RECEIVER@V0100" })),
    (error: unknown) => error instanceof P2StableError,
  );
});
