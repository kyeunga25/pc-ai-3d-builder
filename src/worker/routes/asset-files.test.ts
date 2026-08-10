import { describe, expect, it } from "vitest";

import { assetFileLimits } from "../../shared/domain/asset-files";
import type { WorkspaceRole } from "../../shared/domain/session";
import { createSyntheticSourcePng } from "../../shared/domain/synthetic-image";
import type { RequestContext } from "../auth/workspace";
import { sha256Hex } from "../lib/digest";
import { createD1Stub } from "../test/d1-stub";
import {
  assetFileResponse,
  assetFileUploadResponse,
  createAssetSourceResponse,
} from "./asset-files";

function context(role: WorkspaceRole = "owner"): RequestContext {
  return {
    user: {
      id: "user-fixture",
      email: "fixture@example.com",
      displayName: "Fixture User",
    },
    currentWorkspace: {
      id: "workspace-fixture",
      slug: "fixture",
      name: "Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role,
    },
    workspaces: [],
  };
}

const minimalSource = createSyntheticSourcePng();
const minimalSourceSha256 = await sha256Hex(minimalSource);
const minimalSourceDigest = await crypto.subtle.digest(
  "SHA-256",
  minimalSource,
);

function minimalGlb(): Uint8Array {
  const rawJson = new TextEncoder().encode(
    JSON.stringify({ asset: { version: "2.0" }, scenes: [{}], scene: 0 }),
  );
  const paddedLength = Math.ceil(rawJson.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + paddedLength);
  bytes.set([0x67, 0x6c, 0x54, 0x46]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20);
  bytes.set(rawJson, 20);
  return bytes;
}

function assetRow(overrides: Record<string, unknown> = {}) {
  return {
    asset_id: "asset-fixture",
    part_id: "part-fixture",
    sku: "FIXTURE-001",
    manufacturer: "Fixture",
    model: "Review Part",
    status: "draft",
    quality: "unreviewed",
    source_kind: "uploaded",
    completed_checks_json: "[]",
    source_rights_confirmed: 0,
    verified_width_mm: null,
    verified_height_mm: null,
    verified_depth_mm: null,
    review_version: 0,
    source_object_key: "private/source-fixture",
    source_content_type: "image/png",
    source_size_bytes: minimalSource.byteLength,
    source_sha256: minimalSourceSha256,
    model_object_key: null,
    model_content_type: null,
    model_size_bytes: null,
    model_sha256: null,
    ...overrides,
  };
}

function createR2Stub(
  initial: Array<{
    key: string;
    bytes: Uint8Array;
    contentType?: string;
    sha256?: ArrayBuffer;
  }> = [],
) {
  const objects = new Map(
    initial.map(({ key, bytes, contentType, sha256 }) => [
      key,
      { bytes, contentType, sha256 },
    ]),
  );
  const puts: string[] = [];
  const putChecksums: Array<R2PutOptions["sha256"]> = [];
  const materializedReads: string[] = [];
  const deletes: string[] = [];
  const bucket = {
    async put(key: string, value: Uint8Array, options?: R2PutOptions) {
      puts.push(key);
      putChecksums.push(options?.sha256);
      const metadata = options?.httpMetadata;
      objects.set(key, {
        bytes: value,
        contentType:
          metadata instanceof Headers
            ? (metadata.get("content-type") ?? undefined)
            : metadata?.contentType,
        sha256: undefined,
      });
      return { key };
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) {
        return null;
      }
      return {
        body: new Response(object.bytes.buffer as ArrayBuffer).body,
        arrayBuffer: async () => {
          materializedReads.push(key);
          return object.bytes.slice().buffer;
        },
        checksums: object.sha256 ? { sha256: object.sha256 } : {},
        size: object.bytes.byteLength,
        httpMetadata: object.contentType
          ? { contentType: object.contentType }
          : undefined,
      };
    },
    async delete(key: string) {
      deletes.push(key);
      objects.delete(key);
    },
  } as unknown as R2Bucket;
  return { bucket, deletes, materializedReads, objects, putChecksums, puts };
}

describe("private asset routes", () => {
  it("creates a workspace-scoped draft after validating and storing a source image", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [{ id: "part-fixture" }, null, assetRow()],
    });
    const { bucket, putChecksums, puts } = createR2Stub();
    const source = minimalSource;
    const request = new Request(
      "https://app.example/api/catalogue/part/source",
      {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "x-rigstage-catalogue-part-id": "part-fixture",
        },
        body: source.buffer as ArrayBuffer,
      },
    );

    const response = await createAssetSourceResponse(
      request,
      db,
      bucket,
      context("staff"),
      "request-fixture",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "asset-fixture",
      files: {
        source: {
          contentType: "image/png",
          sizeBytes: minimalSource.byteLength,
        },
        model: null,
      },
    });
    expect(puts).toHaveLength(1);
    expect(putChecksums[0]).toEqual(new Uint8Array(minimalSourceDigest));
    const auditCall = calls.find((call) =>
      call.sql.includes("asset.file.source.create"),
    );
    expect(auditCall?.sql).toContain("changes() = 1");
    expect(auditCall?.values.join(" ")).not.toContain("workspaces/");
  });

  it("rejects viewer uploads before reading or storing a file", async () => {
    const { calls, db } = createD1Stub();
    const { bucket, puts } = createR2Stub();
    const request = new Request(
      "https://app.example/api/catalogue/part/source",
      {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "x-rigstage-catalogue-part-id": "part-fixture",
        },
        body: new Uint8Array([0x89]).buffer as ArrayBuffer,
      },
    );

    await expect(
      createAssetSourceResponse(
        request,
        db,
        bucket,
        context("viewer"),
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(calls).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  it.each([null, "../../escape"])(
    "rejects a missing or malformed catalogue target before body, D1 or R2 work: %s",
    async (partId) => {
      const { calls, db } = createD1Stub();
      const { bucket, puts } = createR2Stub();
      const headers = new Headers({ "content-type": "image/png" });
      if (partId !== null) {
        headers.set("x-rigstage-catalogue-part-id", partId);
      }
      const request = new Request(
        "https://app.example/api/catalogue/part/source",
        {
          method: "POST",
          headers,
          body: minimalSource.buffer as ArrayBuffer,
        },
      );

      await expect(
        createAssetSourceResponse(
          request,
          db,
          bucket,
          context("staff"),
          "request-target-fixture",
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "CATALOGUE_PART_NOT_FOUND",
      });
      expect(request.bodyUsed).toBe(false);
      expect(calls).toHaveLength(0);
      expect(puts).toHaveLength(0);
    },
  );

  it("rejects a signature-only source before private storage or mutation", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [{ id: "part-fixture" }, null],
    });
    const { bucket, puts } = createR2Stub();
    const request = new Request(
      "https://app.example/api/catalogue/part/source",
      {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "x-rigstage-catalogue-part-id": "part-fixture",
        },
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          .buffer as ArrayBuffer,
      },
    );

    await expect(
      createAssetSourceResponse(
        request,
        db,
        bucket,
        context("staff"),
        "request-invalid-source",
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/容器.*container/iu),
    });
    expect(puts).toHaveLength(0);
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("uploads a GLB with an optimistic version and removes the replaced object", async () => {
    const glb = minimalGlb();
    const updated = assetRow({
      review_version: 1,
      model_object_key: "private/new-model",
      model_content_type: "model/gltf-binary",
      model_size_bytes: glb.byteLength,
      model_sha256: "b".repeat(64),
    });
    const { calls, db } = createD1Stub({
      firstResults: [
        assetRow({ model_object_key: "private/old-model" }),
        updated,
      ],
    });
    const { bucket, deletes, puts } = createR2Stub([
      { key: "private/old-model", bytes: glb },
    ]);
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/files/model",
      {
        method: "PUT",
        headers: {
          "content-type": "model/gltf-binary",
          "x-rigstage-expected-version": "0",
        },
        body: glb.buffer as ArrayBuffer,
      },
    );

    const response = await assetFileUploadResponse(
      request,
      db,
      bucket,
      context(),
      "asset-fixture",
      "model",
      "request-fixture",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: 1,
      files: {
        model: {
          contentType: "model/gltf-binary",
          sizeBytes: glb.byteLength,
        },
      },
    });
    expect(puts).toHaveLength(1);
    expect(deletes).toEqual(["private/old-model"]);
    expect(
      calls.find((call) => call.values.includes("asset.file.model.upload"))
        ?.sql,
    ).toContain("changes() = 1");
  });

  it("rejects an oversized replacement before private storage or mutation", async () => {
    const { calls, db } = createD1Stub({ firstResults: [assetRow()] });
    const { bucket, deletes, puts } = createR2Stub();
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/files/source",
      {
        method: "PUT",
        headers: {
          "content-length": String(assetFileLimits.source + 1),
          "content-type": "image/png",
          "x-rigstage-expected-version": "0",
        },
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          .buffer as ArrayBuffer,
      },
    );

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context("staff"),
        "asset-fixture",
        "source",
        "request-oversized",
      ),
    ).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
    expect(puts).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("locks an approved asset before reading or storing its replacement", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [assetRow({ status: "approved", quality: "approved" })],
    });
    const { bucket, deletes, puts } = createR2Stub();
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/files/source",
      {
        method: "PUT",
        headers: {
          "content-length": String(assetFileLimits.source + 1),
          "content-type": "image/png",
          "x-rigstage-expected-version": "0",
        },
        body: new Uint8Array([0x89]).buffer as ArrayBuffer,
      },
    );

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context(),
        "asset-fixture",
        "source",
        "request-approved",
      ),
    ).rejects.toMatchObject({ status: 409, code: "ASSET_LOCKED" });
    expect(puts).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("removes only the new object when an optimistic update loses a race", async () => {
    const source = minimalSource;
    const current = assetRow({ source_object_key: "private/old-source" });
    const { db } = createD1Stub({
      batchChanges: 0,
      firstResults: [current, current],
    });
    const { bucket, deletes, objects, puts } = createR2Stub([
      { key: "private/old-source", bytes: source },
    ]);
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/files/source",
      {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-rigstage-expected-version": "0",
        },
        body: source.buffer as ArrayBuffer,
      },
    );

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context("admin"),
        "asset-fixture",
        "source",
        "request-race",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });
    expect(puts).toHaveLength(1);
    expect(puts[0]).not.toBe("private/old-source");
    expect(deletes).toEqual([puts[0]]);
    expect(objects.has("private/old-source")).toBe(true);
    expect(objects.has(puts[0]!)).toBe(false);
  });

  it("streams a private file only after a workspace-scoped asset lookup", async () => {
    const source = minimalSource;
    const { calls, db } = createD1Stub({
      firstResults: [assetRow()],
    });
    const { bucket, materializedReads } = createR2Stub([
      {
        key: "private/source-fixture",
        bytes: source,
        contentType: "image/png",
        sha256: minimalSourceDigest,
      },
    ]);

    const response = await assetFileResponse(
      db,
      bucket,
      context("viewer"),
      "asset-fixture",
      "source",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="source.png"',
    );
    expect(JSON.stringify([...response.headers])).not.toContain(
      "private/source-fixture",
    );
    expect((await response.arrayBuffer()).byteLength).toBe(
      minimalSource.byteLength,
    );
    expect(materializedReads).toEqual([]);
    expect(calls[0]?.values).toEqual(["workspace-fixture", "asset-fixture"]);
  });

  it.each([
    {
      label: "source size",
      kind: "source",
      row: assetRow(),
      stored: {
        key: "private/source-fixture",
        bytes: new Uint8Array(7),
        contentType: "image/png",
      },
    },
    {
      label: "source checksum",
      kind: "source",
      row: assetRow(),
      stored: {
        key: "private/source-fixture",
        bytes: minimalSource,
        contentType: "image/png",
        sha256: new Uint8Array(32).fill(0xff).buffer,
      },
    },
    {
      label: "model content type",
      kind: "model",
      row: assetRow({
        model_object_key: "private/model-fixture",
        model_content_type: "model/gltf-binary",
        model_size_bytes: 8,
        model_sha256: "b".repeat(64),
      }),
      stored: {
        key: "private/model-fixture",
        bytes: new Uint8Array(8),
        contentType: "application/octet-stream",
      },
    },
  ])("rejects a private $label mismatch", async ({ kind, row, stored }) => {
    const { calls, db } = createD1Stub({ firstResults: [row] });
    const { bucket } = createR2Stub([stored]);

    await expect(
      assetFileResponse(db, bucket, context("viewer"), "asset-fixture", kind),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_FILE_NOT_FOUND" });
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("keeps an R2 read failure as an operational error", async () => {
    const storageError = new Error("synthetic R2 read failure");
    const { db } = createD1Stub({ firstResults: [assetRow()] });
    const bucket = {
      async get() {
        throw storageError;
      },
    } as unknown as R2Bucket;

    await expect(
      assetFileResponse(
        db,
        bucket,
        context("viewer"),
        "asset-fixture",
        "source",
      ),
    ).rejects.toBe(storageError);
  });
});
