import { z } from "zod";

import { workspaceRoleSchema, type WorkspaceRole } from "./session";

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true;
    }
  }
  return false;
}

const boundedMemberIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
const boundedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
const boundedDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((value) => !hasControlCharacter(value));

export const workspaceMemberStatusSchema = z.enum(["active", "suspended"]);
export const workspaceMemberIdentityStateSchema = z.enum([
  "pending",
  "bound",
  "blocked",
]);

export const workspaceMemberSchema = z.object({
  id: boundedMemberIdSchema,
  email: z.email().max(254),
  displayName: boundedDisplayNameSchema,
  role: workspaceRoleSchema,
  status: workspaceMemberStatusSchema,
  identityState: workspaceMemberIdentityStateSchema,
  isCurrentUser: z.boolean(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().trim().min(1).max(64),
});

export const workspaceMemberListResponseSchema = z.object({
  items: z.array(workspaceMemberSchema).max(100),
  hasMore: z.boolean(),
});

export const workspaceMemberInviteSchema = z
  .object({
    email: boundedEmailSchema,
    displayName: boundedDisplayNameSchema,
    role: workspaceRoleSchema,
  })
  .strict();

export const workspaceMemberUpdateSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    role: workspaceRoleSchema,
    status: workspaceMemberStatusSchema,
  })
  .strict();

export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceMemberListResponse = z.infer<
  typeof workspaceMemberListResponseSchema
>;
export type WorkspaceMemberInvite = z.infer<typeof workspaceMemberInviteSchema>;
export type WorkspaceMemberUpdate = z.infer<typeof workspaceMemberUpdateSchema>;
export type WorkspaceMemberStatus = z.infer<typeof workspaceMemberStatusSchema>;
export type WorkspaceMemberIdentityState = z.infer<
  typeof workspaceMemberIdentityStateSchema
>;

const ownerAssignableRoles = ["owner", "admin", "staff", "viewer"] as const;
const adminAssignableRoles = ["staff", "viewer"] as const;

export function assignableWorkspaceMemberRoles(
  actorRole: WorkspaceRole,
): readonly WorkspaceRole[] {
  if (actorRole === "owner") {
    return ownerAssignableRoles;
  }
  if (actorRole === "admin") {
    return adminAssignableRoles;
  }
  return [];
}

export function canAssignWorkspaceMemberRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): boolean {
  return assignableWorkspaceMemberRoles(actorRole).includes(targetRole);
}
