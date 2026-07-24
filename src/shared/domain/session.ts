import { z } from "zod";

export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "staff",
  "viewer",
]);

export const workspaceSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  locale: z.string().min(1),
  currency: z.string().length(3),
  role: workspaceRoleSchema,
});

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.email(),
    displayName: z.string().min(1),
  }),
  currentWorkspace: workspaceSummarySchema,
  workspaces: z.array(workspaceSummarySchema).min(1),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

export function accountInitials(displayName: string, email: string): string {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);

  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}
