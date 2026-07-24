import type { RequestContext } from "../auth/workspace";

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
