import {
  persistWorkspaceSelection,
  type RequestContext,
} from "../auth/workspace";

const sessionHeaders = { "cache-control": "no-store" } as const;

export function sessionResponse(context: RequestContext): Response {
  return Response.json(context, { headers: sessionHeaders });
}

export function workspacesResponse(context: RequestContext): Response {
  return Response.json(
    {
      currentWorkspaceId: context.currentWorkspace.id,
      workspaces: context.workspaces,
    },
    { headers: sessionHeaders },
  );
}

export async function workspaceSelectionResponse(
  db: D1Database,
  context: RequestContext,
  accessSubject: string,
): Promise<Response> {
  await persistWorkspaceSelection(db, context, accessSubject);
  return sessionResponse(context);
}
