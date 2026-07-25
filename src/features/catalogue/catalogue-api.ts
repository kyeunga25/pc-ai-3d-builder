import {
  catalogueResponseSchema,
  type CatalogueResponse,
} from "../../shared/domain/schemas";

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
    headers: {
      accept: "application/json",
      "x-rigstage-workspace-id": workspaceId,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Catalogue request failed with status ${response.status}.`);
  }

  return catalogueResponseSchema.parse(await response.json());
}
