import { createHash } from "node:crypto";
import { StableRuntimeError, deep_freeze } from "../src/p0/runtime_contract.ts";

export type P2GovernedDataCategory = "STATIC" | "DYNAMIC" | "RUNTIME";
export type JsonObject = Readonly<Record<string, unknown>>;

const FILE_NAMES: Readonly<Record<P2GovernedDataCategory, string>> = Object.freeze({
  STATIC: "static.json",
  DYNAMIC: "dynamic.json",
  RUNTIME: "runtime.json",
});

const GOOGLE_DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const JSON_MIME = "application/json";

export interface P2GoogleDriveMaterialLocator {
  readonly provider: "GOOGLE_DRIVE";
  readonly root_folder_id: string;
  readonly owner_folder_id: string;
  readonly subject_folder_id: string;
  readonly file_id: string;
  readonly revision_id: string;
  readonly file_name: string;
  readonly owner_ref: string;
  readonly subject_ref: string;
  readonly data_category: P2GovernedDataCategory;
  readonly content_hash: string;
}

export interface P2GoogleDriveStoredMaterial {
  readonly locator: P2GoogleDriveMaterialLocator;
  readonly exact_json_bytes: Uint8Array;
}

export interface GoogleDriveChild {
  readonly id: string;
  readonly name: string;
  readonly mime_type: string;
}

export interface GoogleDriveWrittenFile extends GoogleDriveChild {
  readonly revision_id: string;
}

export interface GoogleDriveP2MaterialTransport {
  findChildren(input: Readonly<{
    parent_id: string;
    name: string;
    mime_type: string;
    trace_id: string;
    request_id: string;
  }>): Promise<readonly GoogleDriveChild[]>;
  createFolder(input: Readonly<{
    parent_id: string;
    name: string;
    trace_id: string;
    request_id: string;
  }>): Promise<GoogleDriveChild>;
  createJsonFile(input: Readonly<{
    parent_id: string;
    name: string;
    bytes: Uint8Array;
    trace_id: string;
    request_id: string;
  }>): Promise<GoogleDriveWrittenFile>;
  replaceJsonFile(input: Readonly<{
    file_id: string;
    name: string;
    bytes: Uint8Array;
    trace_id: string;
    request_id: string;
  }>): Promise<GoogleDriveWrittenFile>;
  readRevision(input: Readonly<{
    file_id: string;
    revision_id: string;
    trace_id: string;
    request_id: string;
  }>): Promise<Uint8Array>;
}

export interface GoogleDriveAccessTokenProvider {
  getAccessToken(input: Readonly<{
    trace_id: string;
    request_id: string;
  }>): Promise<string>;
}

export interface GoogleDriveFetchTransportOptions {
  readonly access_token_provider: GoogleDriveAccessTokenProvider;
  readonly fetch_impl?: typeof fetch;
}

export interface P2GoogleDriveMaterialStore {
  writeExactJson(input: Readonly<{
    owner_ref: string;
    subject_ref: string;
    data_category: P2GovernedDataCategory;
    exact_json_bytes: Uint8Array;
    expected_content_hash?: string;
    trace_id: string;
    request_id: string;
  }>): Promise<P2GoogleDriveStoredMaterial>;
  writeJsonObject(input: Readonly<{
    owner_ref: string;
    subject_ref: string;
    data_category: P2GovernedDataCategory;
    material: JsonObject;
    expected_content_hash?: string;
    trace_id: string;
    request_id: string;
  }>): Promise<P2GoogleDriveStoredMaterial>;
  readExact(input: Readonly<{
    locator: P2GoogleDriveMaterialLocator;
    trace_id: string;
    request_id: string;
  }>): Promise<Uint8Array>;
}

export class P2GoogleDriveMaterialStoreError extends StableRuntimeError {
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(code, message, details);
    this.name = "P2GoogleDriveMaterialStoreError";
  }
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_INVALID",
      \`\${field} must be a non-empty string\`,
    );
  }
  return value;
}

function exactCategory(value: unknown): P2GovernedDataCategory {
  if (value !== "STATIC" && value !== "DYNAMIC" && value !== "RUNTIME") {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_INVALID",
      "data_category must be STATIC, DYNAMIC, or RUNTIME",
    );
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return \`sha256:\${createHash("sha256").update(bytes).digest("hex")}\`;
}

function validateHash(value: unknown, field: string): string {
  const text = nonEmptyString(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_INVALID",
      \`\${field} must be an exact sha256 binding\`,
    );
  }
  return text;
}

function objectValue(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_INVALID",
      \`\${field} must be an object\`,
    );
  }
  return value as JsonObject;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = stableValue(source[key]);
    return out;
  }
  return value;
}

export function serializeP2MaterialJson(material: JsonObject): Uint8Array {
  objectValue(material, "material");
  return Buffer.from(\`\${JSON.stringify(stableValue(material))}\n\`, "utf8");
}

function assertJsonBytes(bytes: Uint8Array): void {
  try {
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
    objectValue(parsed, "material_json");
  } catch (error) {
    if (error instanceof P2GoogleDriveMaterialStoreError) throw error;
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_JSON_INVALID",
      "P2 material bytes must be one valid JSON object",
    );
  }
}

function exactlyOne<T>(items: readonly T[], field: string): T | undefined {
  if (items.length > 1) {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_AMBIGUOUS",
      \`multiple Google Drive entries matched \${field}\`,
    );
  }
  return items[0];
}

async function ensureFolder(
  transport: GoogleDriveP2MaterialTransport,
  parentId: string,
  name: string,
  traceId: string,
  requestId: string,
): Promise<GoogleDriveChild> {
  const existing = exactlyOne(
    await transport.findChildren({
      parent_id: parentId,
      name,
      mime_type: GOOGLE_DRIVE_FOLDER_MIME,
      trace_id: traceId,
      request_id: requestId,
    }),
    name,
  );
  if (existing !== undefined) return existing;
  const created = await transport.createFolder({
    parent_id: parentId,
    name,
    trace_id: traceId,
    request_id: requestId,
  });
  if (created.mime_type !== GOOGLE_DRIVE_FOLDER_MIME || created.name !== name) {
    throw new P2GoogleDriveMaterialStoreError(
      "P2_MATERIAL_STORE_WRITE_INVALID",
      "created Google Drive folder does not preserve the exact requested folder identity",
    );
  }
  return created;
}

export function createGoogleDriveP2MaterialStore(
  options: Readonly<{
    root_folder_id: string;
    transport: GoogleDriveP2MaterialTransport;
  }>,
): P2GoogleDriveMaterialStore {
  const rootFolderId = nonEmptyString(options.root_folder_id, "root_folder_id");
  const transport = options.transport;

  return Object.freeze({
    async writeExactJson(input) {
      const ownerRef = nonEmptyString(input.owner_ref, "owner_ref");
      const subjectRef = nonEmptyString(input.subject_ref, "subject_ref");
      const category = exactCategory(input.data_category);
      const traceId = nonEmptyString(input.trace_id, "trace_id");
      const requestId = nonEmptyString(input.request_id, "request_id");
      const bytes = Uint8Array.from(input.exact_json_bytes);
      assertJsonBytes(bytes);
      const contentHash = sha256(bytes);
      if (
        input.expected_content_hash !== undefined
        && validateHash(input.expected_content_hash, "expected_content_hash") !== contentHash
      ) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_CONTENT_HASH_MISMATCH",
          "material bytes do not match expected_content_hash",
        );
      }

      const ownerFolder = await ensureFolder(
        transport,
        rootFolderId,
        ownerRef,
        traceId,
        requestId,
      );
      const subjectFolder = await ensureFolder(
        transport,
        ownerFolder.id,
        subjectRef,
        traceId,
        requestId,
      );
      const fileName = FILE_NAMES[category];
      const existing = exactlyOne(
        await transport.findChildren({
          parent_id: subjectFolder.id,
          name: fileName,
          mime_type: JSON_MIME,
          trace_id: traceId,
          request_id: requestId,
        }),
        \`\${ownerRef}/\${subjectRef}/\${fileName}\`,
      );

      const written = existing === undefined
        ? await transport.createJsonFile({
          parent_id: subjectFolder.id,
          name: fileName,
          bytes,
          trace_id: traceId,
          request_id: requestId,
        })
        : await transport.replaceJsonFile({
          file_id: existing.id,
          name: fileName,
          bytes,
          trace_id: traceId,
          request_id: requestId,
        });

      if (written.name !== fileName || written.mime_type !== JSON_MIME) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_STORE_WRITE_INVALID",
          "Google Drive material file does not preserve the required three-file physical name",
        );
      }
      const revisionId = nonEmptyString(written.revision_id, "revision_id");
      const readBack = await transport.readRevision({
        file_id: written.id,
        revision_id: revisionId,
        trace_id: traceId,
        request_id: requestId,
      });
      const readBackHash = sha256(readBack);
      if (readBackHash !== contentHash || !Buffer.from(readBack).equals(Buffer.from(bytes))) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_READBACK_MISMATCH",
          "Google Drive exact revision read-back does not match written material bytes",
        );
      }

      const locator = deep_freeze({
        provider: "GOOGLE_DRIVE" as const,
        root_folder_id: rootFolderId,
        owner_folder_id: ownerFolder.id,
        subject_folder_id: subjectFolder.id,
        file_id: written.id,
        revision_id: revisionId,
        file_name: fileName,
        owner_ref: ownerRef,
        subject_ref: subjectRef,
        data_category: category,
        content_hash: contentHash,
      } satisfies P2GoogleDriveMaterialLocator);

      return Object.freeze({
        locator,
        exact_json_bytes: Uint8Array.from(readBack),
      });
    },

    async writeJsonObject(input) {
      return this.writeExactJson({
        owner_ref: input.owner_ref,
        subject_ref: input.subject_ref,
        data_category: input.data_category,
        exact_json_bytes: serializeP2MaterialJson(input.material),
        ...(input.expected_content_hash === undefined
          ? {}
          : { expected_content_hash: input.expected_content_hash }),
        trace_id: input.trace_id,
        request_id: input.request_id,
      });
    },

    async readExact(input) {
      const locator = input.locator;
      if (locator.provider !== "GOOGLE_DRIVE") {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_STORE_INVALID",
          "locator provider must be GOOGLE_DRIVE",
        );
      }
      if (locator.root_folder_id !== rootFolderId) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_STORE_ROOT_MISMATCH",
          "locator root_folder_id does not match this material store",
        );
      }
      const expectedName = FILE_NAMES[exactCategory(locator.data_category)];
      if (locator.file_name !== expectedName) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_STORE_INVALID",
          "locator file_name does not match data_category",
        );
      }
      const expectedHash = validateHash(locator.content_hash, "locator.content_hash");
      const bytes = await transport.readRevision({
        file_id: nonEmptyString(locator.file_id, "locator.file_id"),
        revision_id: nonEmptyString(locator.revision_id, "locator.revision_id"),
        trace_id: nonEmptyString(input.trace_id, "trace_id"),
        request_id: nonEmptyString(input.request_id, "request_id"),
      });
      if (sha256(bytes) !== expectedHash) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_MATERIAL_CONTENT_HASH_MISMATCH",
          "exact Google Drive revision does not match locator content_hash",
        );
      }
      assertJsonBytes(bytes);
      return Uint8Array.from(bytes);
    },
  });
}

function driveQueryLiteral(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

type DriveFileResponse = Readonly<{
  id?: unknown;
  name?: unknown;
  mimeType?: unknown;
  headRevisionId?: unknown;
}>;

function driveFile(value: DriveFileResponse, requireRevision: boolean): GoogleDriveWrittenFile {
  const id = nonEmptyString(value.id, "drive_file.id");
  const name = nonEmptyString(value.name, "drive_file.name");
  const mimeType = nonEmptyString(value.mimeType, "drive_file.mimeType");
  const revisionId = requireRevision
    ? nonEmptyString(value.headRevisionId, "drive_file.headRevisionId")
    : "";
  return Object.freeze({
    id,
    name,
    mime_type: mimeType,
    revision_id: revisionId,
  });
}

export function createGoogleDriveFetchP2MaterialTransport(
  options: Readonly<GoogleDriveFetchTransportOptions>,
): GoogleDriveP2MaterialTransport {
  const fetchImpl = options.fetch_impl ?? fetch;

  async function auth(traceId: string, requestId: string): Promise<string> {
    return nonEmptyString(
      await options.access_token_provider.getAccessToken({
        trace_id: traceId,
        request_id: requestId,
      }),
      "google_drive_access_token",
    );
  }

  async function checkedFetch(
    url: string,
    init: RequestInit,
    traceId: string,
    requestId: string,
  ): Promise<Response> {
    const token = await auth(traceId, requestId);
    const headers = new Headers(init.headers);
    headers.set("Authorization", \`Bearer \${token}\`);
    const response = await fetchImpl(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      throw new P2GoogleDriveMaterialStoreError(
        "P2_GOOGLE_DRIVE_REQUEST_FAILED",
        \`Google Drive request failed with HTTP \${response.status}\`,
        Object.freeze({ body: body.slice(0, 1000) }),
      );
    }
    return response;
  }

  async function jsonResponse(
    url: string,
    init: RequestInit,
    traceId: string,
    requestId: string,
  ): Promise<JsonObject> {
    const response = await checkedFetch(url, init, traceId, requestId);
    return objectValue(await response.json(), "google_drive_response");
  }

  return Object.freeze({
    async findChildren(input) {
      const q = \`'\${driveQueryLiteral(input.parent_id)}' in parents and name = '\${driveQueryLiteral(input.name)}' and mimeType = '\${driveQueryLiteral(input.mime_type)}' and trashed = false\`;
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", q);
      url.searchParams.set("pageSize", "10");
      url.searchParams.set("fields", "files(id,name,mimeType)");
      const payload = await jsonResponse(
        url.toString(),
        { method: "GET" },
        input.trace_id,
        input.request_id,
      );
      const rawFiles = payload.files;
      if (!Array.isArray(rawFiles)) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_GOOGLE_DRIVE_RESPONSE_INVALID",
          "Google Drive files search response must contain files[]",
        );
      }
      return Object.freeze(rawFiles.map((value) => {
        const file = driveFile(objectValue(value, "drive_file"), false);
        return Object.freeze({
          id: file.id,
          name: file.name,
          mime_type: file.mime_type,
        });
      }));
    },

    async createFolder(input) {
      const payload = await jsonResponse(
        "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
        {
          method: "POST",
          headers: { "Content-Type": JSON_MIME },
          body: JSON.stringify({
            name: input.name,
            mimeType: GOOGLE_DRIVE_FOLDER_MIME,
            parents: [input.parent_id],
          }),
        },
        input.trace_id,
        input.request_id,
      );
      const file = driveFile(payload, false);
      return Object.freeze({
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
      });
    },

    async createJsonFile(input) {
      const boundary = "q-p2-material-boundary";
      const prefix = Buffer.from(
        \`--\${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n\${JSON.stringify({
          name: input.name,
          mimeType: JSON_MIME,
          parents: [input.parent_id],
        })}\r\n--\${boundary}\r\nContent-Type: application/json\r\n\r\n\`,
        "utf8",
      );
      const suffix = Buffer.from(\`\r\n--\${boundary}--\r\n\`, "utf8");
      const body = Buffer.concat([prefix, Buffer.from(input.bytes), suffix]);
      const payload = await jsonResponse(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,headRevisionId",
        {
          method: "POST",
          headers: { "Content-Type": \`multipart/related; boundary=\${boundary}\` },
          body: arrayBuffer(body),
        },
        input.trace_id,
        input.request_id,
      );
      return driveFile(payload, true);
    },

    async replaceJsonFile(input) {
      const payload = await jsonResponse(
        \`https://www.googleapis.com/upload/drive/v3/files/\${encodeURIComponent(input.file_id)}?uploadType=media&fields=id,name,mimeType,headRevisionId\`,
        {
          method: "PATCH",
          headers: { "Content-Type": JSON_MIME },
          body: arrayBuffer(input.bytes),
        },
        input.trace_id,
        input.request_id,
      );
      const file = driveFile(payload, true);
      if (file.name !== input.name) {
        throw new P2GoogleDriveMaterialStoreError(
          "P2_GOOGLE_DRIVE_RESPONSE_INVALID",
          "updated Google Drive file name changed unexpectedly",
        );
      }
      return file;
    },

    async readRevision(input) {
      const response = await checkedFetch(
        \`https://www.googleapis.com/drive/v3/files/\${encodeURIComponent(input.file_id)}/revisions/\${encodeURIComponent(input.revision_id)}?alt=media\`,
        { method: "GET" },
        input.trace_id,
        input.request_id,
      );
      return new Uint8Array(await response.arrayBuffer());
    },
  });
}
