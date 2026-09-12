import assert from "node:assert/strict";
import test from "node:test";
import { entry } from "../../../../src/p1/export/capability_presentation/entry.ts";
import { capability_extraction_metadata } from "../../../../src/p1/export/capability_presentation/metadata.ts";

test("capability_presentation PUBLICATION_ELIGIBLE export is static metadata only", () => {
  assert.equal(entry, capability_extraction_metadata);
  assert.equal(entry.extraction_mode, "PUBLICATION_ELIGIBLE");
  assert.equal(entry.capability_contract_ref, "Q.APP.CONTRACT.CAPABILITY.CAPABILITY_PRESENTATION@V0104");
  assert.equal(entry.capability_contract_hash, "sha256:795a646eb362a598b5ce928e2d0570ffba23c4fe139069b9935f8f6974884051");
  assert.equal(Object.prototype.hasOwnProperty.call(entry, "handler"), false);
});
