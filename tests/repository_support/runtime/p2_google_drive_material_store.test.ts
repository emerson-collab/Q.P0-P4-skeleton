import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createGoogleDriveP2MaterialStore,
  serializeP2MaterialJson,
  type GoogleDriveChild,
  type GoogleDriveP2MaterialTransport,
  type GoogleDriveWrittenFile,
  type P2GovernedDataCategory,
} from "../../../runtime/p2_google_drive_material_store.ts";

function hash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fakeTransport() {
  let nextId = 1;
  let nextRevision = 1;
  const children = new Map<string, GoogleDriveChild[]>();
  const revisions = new Map<string, Uint8Array>();

  function key(parentId: string): string {
    return parentId;
  }

  function addChild(parentId: string, child: GoogleDriveChild): void {
    children.set(key(parentId), [...(children.get(key(parentId)) ?? []), child]);
  }

  const transport: GoogleDriveP2MaterialTransport = {
    async findChildren(input) {
      return Object.freeze(
        (children.get(key(input.parent_id)) ?? []).filter(
          (item) => item.name === input.name && item.mime_type === input.mime_type,
        ),
      );
    },

    async createFolder(input) {
      const child = Object.freeze({
        id: `folder-${nextId++}`,
        name: input.name,
        mime_type: "application/vnd.google-apps.folder",
      });
      addChild(input.parent_id, child);
      return child;
    },

    async createJsonFile(input) {
      const child: GoogleDriveWrittenFile = Object.freeze({
        id: `file-${nextId++}`,
        name: input.name,
        mime_type: "application/json",
        revision_id: `rev-${nextRevision++}`,
      });
      addChild(input.parent_id, child);
      revisions.set(`${child.id}@${child.revision_id}`, Uint8Array.from(input.bytes));
      return child;
    },

    async replaceJsonFile(input) {
      const existing = [...children.values()]
        .flat()
        .find((item) => item.id === input.file_id);
      assert.ok(existing);
      const written: GoogleDriveWrittenFile = Object.freeze({
        id: input.file_id,
        name: input.name,
        mime_type: "application/json",
        revision_id: `rev-${nextRevision++}`,
      });
      revisions.set(`${written.id}@${written.revision_id}`, Uint8Array.from(input.bytes));
      return written;
    },

    async readRevision(input) {
      const bytes = revisions.get(`${input.file_id}@${input.revision_id}`);
      assert.ok(bytes);
      return Uint8Array.from(bytes);
    },
  };

  return { transport: Object.freeze(transport), children };
}

test("P2 Google Drive store materializes exactly static.json, dynamic.json, runtime.json under owner/subject", async () => {
  const fake = fakeTransport();
  const store = createGoogleDriveP2MaterialStore({
    root_folder_id: "drive-root",
    transport: fake.transport,
  });
  const owner = "q.p1.domain.q_test";
  const subject = "Q.TEST.CAPABILITY.EXAMPLE@V0100";
  const categories: readonly P2GovernedDataCategory[] = ["STATIC", "DYNAMIC", "RUNTIME"];

  const stored = [];
  for (const category of categories) {
    stored.push(await store.writeJsonObject({
      owner_ref: owner,
      subject_ref: subject,
      data_category: category,
      material: { category, value: 1 },
      trace_id: "trace-1",
      request_id: `request-${category}`,
    }));
  }

  assert.deepEqual(
    stored.map((item) => item.locator.file_name),
    ["static.json", "dynamic.json", "runtime.json"],
  );
  assert.equal(new Set(stored.map((item) => item.locator.owner_folder_id)).size, 1);
  assert.equal(new Set(stored.map((item) => item.locator.subject_folder_id)).size, 1);
  for (const item of stored) {
    assert.equal(item.locator.owner_ref, owner);
    assert.equal(item.locator.subject_ref, subject);
    assert.equal(item.locator.content_hash, hash(item.exact_json_bytes));
    const read = await store.readExact({
      locator: item.locator,
      trace_id: "trace-read",
      request_id: "request-read",
    });
    assert.deepEqual(read, item.exact_json_bytes);
  }
});

test("P2 Google Drive store keeps one physical category file and advances exact revision", async () => {
  const fake = fakeTransport();
  const store = createGoogleDriveP2MaterialStore({
    root_folder_id: "drive-root",
    transport: fake.transport,
  });

  const first = await store.writeJsonObject({
    owner_ref: "owner",
    subject_ref: "subject",
    data_category: "RUNTIME",
    material: { revision: 1 },
    trace_id: "trace-1",
    request_id: "request-1",
  });
  const second = await store.writeJsonObject({
    owner_ref: "owner",
    subject_ref: "subject",
    data_category: "RUNTIME",
    material: { revision: 2 },
    trace_id: "trace-2",
    request_id: "request-2",
  });

  assert.equal(first.locator.file_id, second.locator.file_id);
  assert.notEqual(first.locator.revision_id, second.locator.revision_id);
  assert.notEqual(first.locator.content_hash, second.locator.content_hash);
  assert.equal(first.locator.file_name, "runtime.json");
  assert.equal(second.locator.file_name, "runtime.json");
});

test("P2 Google Drive store fails closed before write when expected hash does not match exact JSON bytes", async () => {
  const fake = fakeTransport();
  const store = createGoogleDriveP2MaterialStore({
    root_folder_id: "drive-root",
    transport: fake.transport,
  });
  const bytes = serializeP2MaterialJson({ value: "x" });

  await assert.rejects(
    () => store.writeExactJson({
      owner_ref: "owner",
      subject_ref: "subject",
      data_category: "STATIC",
      exact_json_bytes: bytes,
      expected_content_hash: `sha256:${"0".repeat(64)}`,
      trace_id: "trace",
      request_id: "request",
    }),
    /material bytes do not match expected_content_hash/,
  );
});
