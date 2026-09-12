import assert from "node:assert/strict";
import test from "node:test";
import { entry } from "../../../../src/p1/export/application_presentation/entry.ts";
import { capability_extraction_metadata } from "../../../../src/p1/export/application_presentation/metadata.ts";

test("application_presentation PUBLICATION_ELIGIBLE export is static metadata only", () => {
  assert.equal(entry, capability_extraction_metadata);
  assert.equal(entry.extraction_mode, "PUBLICATION_ELIGIBLE");
  assert.equal(entry.capability_contract_ref, "Q.APP.CONTRACT.CAPABILITY.APPLICATION_PRESENTATION@V0104");
  assert.equal(entry.capability_contract_hash, "sha256:d1c45325e5a08b80234d1354b5ab30489162868468b74892e70852921ecb3104");
  assert.equal(Object.prototype.hasOwnProperty.call(entry, "handler"), false);
});
