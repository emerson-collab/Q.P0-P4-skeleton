import test from "node:test";
import assert from "node:assert/strict";
import { handler, P2StableError, STAGE_CONTRACT_REF } from "#q/p2/consumer/external_capability_mounting/consume_publication/handler.ts";

const baseRequest = (input: Record<string, unknown>) => ({
  input,
  runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
  trace_id: "trace-p2",
  request_id: "request-p2",
});

test("consume_publication materializes declared P2 semantics", async () => {
  const response = await handler(baseRequest({
  publication: {
    immutable: true,
    capability_contract_ref: "Q.EXAMPLE.CONTRACT.CAPABILITY.SEARCH@V0100",
    capability_contract_hash: `sha256:${"a".repeat(64)}`,
    publication_hash: `sha256:${"b".repeat(64)}`,
  },
  verification: { integrity_verified: true },
}));
  assert.equal(response.outcome_type, "response");
  assert.equal(response.trace_id, "trace-p2");
  assert.equal(response.request_id, "request-p2");
  assert.equal(typeof response.runtime_result.result_kind, "string");
});

test("consume_publication fails closed on invalid or forbidden material", async () => {
  await assert.rejects(
    () => handler(baseRequest({ publication: { immutable: false }, verification: { integrity_verified: false } })),
    (error: unknown) => error instanceof P2StableError,
  );
});
