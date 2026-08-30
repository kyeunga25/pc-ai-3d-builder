import { describe, expect, it } from "vitest";

import { assetFileLimits } from "../../shared/domain/asset-files";
import type { WorkspaceRole } from "../../shared/domain/session";
import { createSyntheticSourcePng } from "../../shared/domain/synthetic-image";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import { assetGenerationCreditReleasedHeader } from "../../shared/lib/asset-target";
import type { RequestContext } from "../auth/workspace";
import { sha256Hex } from "../lib/digest";
import { createD1Stub } from "../test/d1-stub";
import {
  assetFileRemoveResponse,
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
        sources: {
          front: {
            contentType: "image/png",
            sizeBytes: minimalSource.byteLength,
          },
          back: null,
          left: null,
          "three-quarter": null,
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
      message: expect.stringMatching(/完整.*complete/iu),
    });
    expect(puts).toHaveLength(0);
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("uploads a GLB with an optimistic version and removes the replaced object", async () => {
    const glb = createSyntheticDraftGlb();
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
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "PUT",
      headers: {
        "content-type": "model/gltf-binary",
        "x-rigstage-asset-file-kind": "model",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-expected-version": "0",
      },
      body: glb.buffer as ArrayBuffer,
    });

    const response = await assetFileUploadResponse(
      request,
      db,
      bucket,
      context(),
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

  it("removes one canonical source file after the guarded D1 transition", async () => {
    const current = assetRow();
    const updated = assetRow({
      review_version: 1,
      source_object_key: null,
      source_content_type: null,
      source_size_bytes: null,
      source_sha256: null,
    });
    const { calls, db } = createD1Stub({ firstResults: [current, updated] });
    const { bucket, deletes } = createR2Stub([
      {
        key: "private/source-fixture",
        bytes: minimalSource,
        contentType: "image/png",
      },
    ]);
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "DELETE",
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-expected-version": "0",
      },
    });

    const response = await assetFileRemoveResponse(
      request,
      db,
      bucket,
      context("staff"),
      "request-remove-source",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get(assetGenerationCreditReleasedHeader)).toBe(
      "false",
    );
    await expect(response.json()).resolves.toMatchObject({
      version: 1,
      sourceRightsConfirmed: false,
      completedChecks: [],
      files: { sources: { front: null } },
    });
    expect(request.body).toBeNull();
    expect(deletes).toEqual(["private/source-fixture"]);
    expect(
      calls.find((call) => call.sql.includes("source_object_key = NULL"))?.sql,
    ).toContain("source_object_key = ?5");
    const auditCall = calls.find((call) =>
      call.values.includes("asset.file.source.remove"),
    );
    expect(auditCall?.sql).toContain("changes() = 1");
    expect(auditCall?.values.join(" ")).not.toContain("private/source");
  });

  it("compensates a reserved generated draft in the same removal batch", async () => {
    const current = assetRow({
      source_kind: "generated",
      model_object_key: "private/generated-model",
      model_content_type: "model/gltf-binary",
      model_size_bytes: 1_024,
      model_sha256: "a".repeat(64),
    });
    const updated = assetRow({
      review_version: 1,
      source_object_key: null,
      source_content_type: null,
      source_size_bytes: null,
      source_sha256: null,
    });
    const { calls, db } = createD1Stub({
      firstResults: [current, { job_id: "job-generated" }, updated],
    });
    const { bucket } = createR2Stub([
      {
        key: "private/source-fixture",
        bytes: minimalSource,
        contentType: "image/png",
      },
    ]);

    const response = await assetFileRemoveResponse(
      new Request("https://app.example/api/assets/item/file", {
        method: "DELETE",
        headers: {
          "x-rigstage-asset-file-kind": "source",
          "x-rigstage-asset-id": "asset-fixture",
          "x-rigstage-expected-version": "0",
        },
      }),
      db,
      bucket,
      context(),
      "request-remove-generated",
    );

    expect(response.headers.get(assetGenerationCreditReleasedHeader)).toBe(
      "true",
    );

    expect(
      calls.some(
        (call) =>
          call.sql.includes("UPDATE generation_jobs") &&
          call.values.includes("GENERATION_DRAFT_SUPERSEDED"),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("UPDATE generation_job_entitlements") &&
          call.values.includes("draft_superseded"),
      ),
    ).toBe(true);
  });

  it("removes only the current GLB while preserving all source metadata", async () => {
    const glb = createSyntheticDraftGlb();
    const glbSha256 = await sha256Hex(glb);
    const current = assetRow({
      model_object_key: "private/model-fixture",
      model_content_type: "model/gltf-binary",
      model_size_bytes: glb.byteLength,
      model_sha256: glbSha256,
    });
    const updated = assetRow({
      review_version: 1,
      model_object_key: null,
      model_content_type: null,
      model_size_bytes: null,
      model_sha256: null,
    });
    const { calls, db } = createD1Stub({ firstResults: [current, updated] });
    const { bucket, deletes } = createR2Stub([
      {
        key: "private/model-fixture",
        bytes: glb,
        contentType: "model/gltf-binary",
      },
    ]);

    const response = await assetFileRemoveResponse(
      new Request("https://app.example/api/assets/item/file", {
        method: "DELETE",
        headers: {
          "x-rigstage-asset-file-kind": "model",
          "x-rigstage-asset-id": "asset-fixture",
          "x-rigstage-expected-version": "0",
        },
      }),
      db,
      bucket,
      context("staff"),
      "request-remove-model",
    );

    await expect(response.json()).resolves.toMatchObject({
      version: 1,
      files: {
        sources: {
          front: {
            contentType: "image/png",
            sizeBytes: minimalSource.byteLength,
          },
        },
        model: null,
      },
    });
    expect(response.headers.get(assetGenerationCreditReleasedHeader)).toBe(
      "false",
    );
    expect(deletes).toEqual(["private/model-fixture"]);
    const updateCall = calls.find((call) =>
      call.sql.includes("model_object_key = NULL"),
    );
    expect(updateCall?.sql).toContain("model_object_key = ?5");
    const auditCall = calls.find((call) =>
      call.values.includes("asset.file.model.remove"),
    );
    expect(auditCall?.values.join(" ")).toContain('"sourceView":null');
    expect(auditCall?.values.join(" ")).not.toContain("private/model");
  });

  it("removes only the selected additional source-view metadata", async () => {
    const current = assetRow({
      source_back_object_key: "private/source-back",
      source_back_content_type: "image/png",
      source_back_size_bytes: minimalSource.byteLength,
      source_back_sha256: minimalSourceSha256,
    });
    const updated = assetRow({ review_version: 1 });
    const { calls, db } = createD1Stub({ firstResults: [current, updated] });
    const { bucket, deletes } = createR2Stub([
      {
        key: "private/source-back",
        bytes: minimalSource,
        contentType: "image/png",
      },
    ]);
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "DELETE",
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "back",
        "x-rigstage-expected-version": "0",
      },
    });

    await assetFileRemoveResponse(
      request,
      db,
      bucket,
      context("admin"),
      "request-remove-back",
    );

    expect(deletes).toEqual(["private/source-back"]);
    const deleteCall = calls.find((call) =>
      call.sql.includes("DELETE FROM product_asset_source_files"),
    );
    expect(deleteCall?.values).toEqual([
      "workspace-fixture",
      "asset-fixture",
      "back",
      "private/source-back",
    ]);
    const auditCall = calls.find((call) =>
      call.values.includes("asset.file.source.remove"),
    );
    expect(auditCall?.values.join(" ")).toContain('"sourceView":"back"');
    expect(auditCall?.values.join(" ")).not.toContain("private/source-back");
  });

  it("rejects a viewer removal before target, D1 or R2 work", async () => {
    const { calls, db } = createD1Stub();
    const { bucket, deletes } = createR2Stub();
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "DELETE",
    });

    await expect(
      assetFileRemoveResponse(
        request,
        db,
        bucket,
        context("viewer"),
        "request-remove-viewer",
      ),
    ).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
    expect(calls).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });

  it("does not mutate or delete when the selected file is missing", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [
        assetRow({
          source_back_object_key: null,
          source_back_content_type: null,
          source_back_size_bytes: null,
          source_back_sha256: null,
        }),
      ],
    });
    const { bucket, deletes } = createR2Stub();
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "DELETE",
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "back",
        "x-rigstage-expected-version": "0",
      },
    });

    await expect(
      assetFileRemoveResponse(
        request,
        db,
        bucket,
        context(),
        "request-remove-missing",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_FILE_NOT_FOUND" });
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
    expect(deletes).toHaveLength(0);
  });

  it.each([
    {
      name: "an unknown source view",
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "rear",
        "x-rigstage-expected-version": "0",
      },
    },
    {
      name: "a source view on a model request",
      headers: {
        "x-rigstage-asset-file-kind": "model",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "front",
        "x-rigstage-expected-version": "0",
      },
    },
    {
      name: "a malformed expected version",
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "front",
        "x-rigstage-expected-version": "-1",
      },
    },
  ])("rejects $name before D1 or R2 work", async ({ headers }) => {
    const { calls, db } = createD1Stub();
    const { bucket, deletes } = createR2Stub();

    await expect(
      assetFileRemoveResponse(
        new Request("https://app.example/api/assets/item/file", {
          method: "DELETE",
          headers,
        }),
        db,
        bucket,
        context(),
        "request-remove-invalid",
      ),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(calls).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });

  it.each([
    {
      name: "an approved asset",
      current: assetRow({ status: "approved" }),
      version: "0",
      code: "ASSET_LOCKED",
    },
    {
      name: "a stale asset version",
      current: assetRow({ review_version: 2 }),
      version: "1",
      code: "ASSET_VERSION_CONFLICT",
    },
  ])("does not mutate or delete $name", async ({ current, version, code }) => {
    const { calls, db } = createD1Stub({ firstResults: [current] });
    const { bucket, deletes } = createR2Stub();

    await expect(
      assetFileRemoveResponse(
        new Request("https://app.example/api/assets/item/file", {
          method: "DELETE",
          headers: {
            "x-rigstage-asset-file-kind": "source",
            "x-rigstage-asset-id": "asset-fixture",
            "x-rigstage-expected-version": version,
          },
        }),
        db,
        bucket,
        context(),
        "request-remove-guarded",
      ),
    ).rejects.toMatchObject({ code });
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
    expect(deletes).toHaveLength(0);
  });

  it("rejects a viewer replacement before target, body, D1 or R2 work", async () => {
    const { calls, db } = createD1Stub();
    const { bucket, puts } = createR2Stub();
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([0x89]).buffer as ArrayBuffer,
    });

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context("viewer"),
        "request-viewer-file",
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "ROLE_FORBIDDEN",
      message: expect.stringMatching(/無權上載.+cannot upload/iu),
    });
    expect(request.bodyUsed).toBe(false);
    expect(calls).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  it.each([
    { assetId: null, kind: "source" },
    { assetId: "../../escape", kind: "source" },
    { assetId: "asset-fixture", kind: null },
    { assetId: "asset-fixture", kind: "thumbnail" },
  ])(
    "rejects a malformed upload target before body, D1 or R2: $assetId/$kind",
    async ({ assetId, kind }) => {
      const { calls, db } = createD1Stub();
      const { bucket, puts } = createR2Stub();
      const headers = new Headers({ "content-type": "image/png" });
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      if (kind !== null) headers.set("x-rigstage-asset-file-kind", kind);
      const request = new Request("https://app.example/api/assets/item/file", {
        method: "PUT",
        headers,
        body: new Uint8Array([0x89]).buffer as ArrayBuffer,
      });

      await expect(
        assetFileUploadResponse(
          request,
          db,
          bucket,
          context("staff"),
          "request-target-file",
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_NOT_FOUND",
        message: "找不到所要求的素材。 / The requested asset was not found.",
      });
      expect(request.bodyUsed).toBe(false);
      expect(calls).toHaveLength(0);
      expect(puts).toHaveLength(0);
    },
  );

  it.each([
    { kind: "source", sourceView: "side" },
    { kind: "model", sourceView: "front" },
  ])(
    "rejects an incompatible $kind source-view header before body, D1 or R2",
    async ({ kind, sourceView }) => {
      const { calls, db } = createD1Stub();
      const { bucket, puts } = createR2Stub();
      const request = new Request("https://app.example/api/assets/item/file", {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-rigstage-asset-file-kind": kind,
          "x-rigstage-asset-id": "asset-fixture",
          "x-rigstage-asset-source-view": sourceView,
          "x-rigstage-expected-version": "0",
        },
        body: minimalSource.buffer as ArrayBuffer,
      });

      await expect(
        assetFileUploadResponse(
          request,
          db,
          bucket,
          context("staff"),
          "request-source-view",
        ),
      ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
      expect(request.bodyUsed).toBe(false);
      expect(calls).toHaveLength(0);
      expect(puts).toHaveLength(0);
    },
  );

  it("rejects an oversized replacement before private storage or mutation", async () => {
    const { calls, db } = createD1Stub({ firstResults: [assetRow()] });
    const { bucket, deletes, puts } = createR2Stub();
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "PUT",
      headers: {
        "content-length": String(assetFileLimits.source + 1),
        "content-type": "image/png",
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-expected-version": "0",
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        .buffer as ArrayBuffer,
    });

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context("staff"),
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
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "PUT",
      headers: {
        "content-length": String(assetFileLimits.source + 1),
        "content-type": "image/png",
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-expected-version": "0",
      },
      body: new Uint8Array([0x89]).buffer as ArrayBuffer,
    });

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context(),
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
    const request = new Request("https://app.example/api/assets/item/file", {
      method: "PUT",
      headers: {
        "content-type": "image/png",
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-expected-version": "0",
      },
      body: source.buffer as ArrayBuffer,
    });

    await expect(
      assetFileUploadResponse(
        request,
        db,
        bucket,
        context("admin"),
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

    const request = new Request("https://app.example/api/assets/item/file", {
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
      },
    });
    const response = await assetFileResponse(
      request,
      db,
      bucket,
      context("viewer"),
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
    { assetId: null, kind: "source" },
    { assetId: "../../escape", kind: "source" },
    { assetId: "asset-fixture", kind: null },
    { assetId: "asset-fixture", kind: "thumbnail" },
  ])(
    "rejects a malformed read target before D1 or R2: $assetId/$kind",
    async ({ assetId, kind }) => {
      const { calls, db } = createD1Stub();
      const { bucket, materializedReads } = createR2Stub();
      const headers = new Headers();
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      if (kind !== null) headers.set("x-rigstage-asset-file-kind", kind);
      const request = new Request("https://app.example/api/assets/item/file", {
        headers,
      });

      await expect(
        assetFileResponse(request, db, bucket, context("viewer")),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_FILE_NOT_FOUND",
      });
      expect(calls).toHaveLength(0);
      expect(materializedReads).toHaveLength(0);
    },
  );

  it("rejects an invalid source view before D1 or R2 read work", async () => {
    const { calls, db } = createD1Stub();
    const { bucket, materializedReads } = createR2Stub();
    const request = new Request("https://app.example/api/assets/item/file", {
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
        "x-rigstage-asset-source-view": "side",
      },
    });

    await expect(
      assetFileResponse(request, db, bucket, context("viewer")),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(calls).toHaveLength(0);
    expect(materializedReads).toHaveLength(0);
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
    const request = new Request("https://app.example/api/assets/item/file", {
      headers: {
        "x-rigstage-asset-file-kind": kind,
        "x-rigstage-asset-id": "asset-fixture",
      },
    });

    await expect(
      assetFileResponse(request, db, bucket, context("viewer")),
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
    const request = new Request("https://app.example/api/assets/item/file", {
      headers: {
        "x-rigstage-asset-file-kind": "source",
        "x-rigstage-asset-id": "asset-fixture",
      },
    });

    await expect(
      assetFileResponse(request, db, bucket, context("viewer")),
    ).rejects.toBe(storageError);
  });
});
