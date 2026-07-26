import {
  catalogueImportResponseSchema,
  catalogueMutationSchema,
  cataloguePartInputSchema,
  catalogueResponseSchema,
  catalogPartSchema,
  type CatalogueImportResponse,
  type CatalogueMutation,
  type CataloguePartInput,
  type CatalogueResponse,
  type CatalogPart,
} from "../../shared/domain/schemas";

export class CatalogueRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CatalogueRequestError";
    this.status = status;
    this.code = code;
  }
}

async function assertCatalogueResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;
  throw new CatalogueRequestError(
    response.status,
    typeof body?.error?.code === "string"
      ? body.error.code
      : "CATALOGUE_REQUEST_FAILED",
    typeof body?.error?.message === "string"
      ? body.error.message
      : "無法完成產品目錄操作。",
  );
}

function workspaceHeaders(workspaceId: string): Headers {
  return new Headers({
    accept: "application/json",
    "x-rigstage-workspace-id": workspaceId,
  });
}

export async function fetchCataloguePage(
  signal: AbortSignal,
  workspaceId: string,
  cursor: string | null = null,
): Promise<CatalogueResponse> {
  const query = new URLSearchParams({ limit: "100" });
  if (cursor) {
    query.set("cursor", cursor);
  }

  const response = await fetch(`/api/catalogue?${query.toString()}`, {
    credentials: "same-origin",
    headers: workspaceHeaders(workspaceId),
    signal,
  });

  await assertCatalogueResponse(response);

  return catalogueResponseSchema.parse(await response.json());
}

export async function createCataloguePart(
  workspaceId: string,
  input: CataloguePartInput,
): Promise<CatalogPart> {
  const body = cataloguePartInputSchema.parse(input);
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  const response = await fetch("/api/catalogue", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });

  await assertCatalogueResponse(response);
  return catalogPartSchema.parse(await response.json());
}

export async function mutateCataloguePart(
  workspaceId: string,
  partId: string,
  mutation: CatalogueMutation,
): Promise<CatalogPart | null> {
  const body = catalogueMutationSchema.parse(mutation);
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  const response = await fetch(`/api/catalogue/${encodeURIComponent(partId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });

  await assertCatalogueResponse(response);
  if (response.status === 204) {
    return null;
  }
  return catalogPartSchema.parse(await response.json());
}

export async function importCatalogueCsv(
  workspaceId: string,
  file: File,
): Promise<CatalogueImportResponse> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "text/csv; charset=utf-8");
  const response = await fetch("/api/catalogue/import", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: file,
  });

  await assertCatalogueResponse(response);
  return catalogueImportResponseSchema.parse(await response.json());
}
