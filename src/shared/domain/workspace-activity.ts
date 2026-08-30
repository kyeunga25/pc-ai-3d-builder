import { z } from "zod";

export const workspaceActivityActions = [
  "workspace.member.invite",
  "workspace.member.update",
  "catalogue.part.create",
  "catalogue.part.import",
  "catalogue.part.update",
  "catalogue.part.archive",
  "asset.file.source.create",
  "asset.file.source.upload",
  "asset.file.model.upload",
  "asset.review.save_draft",
  "asset.review.approve",
  "asset.review.reject",
  "build.create",
  "build.update",
  "build.archive",
  "generation.request",
  "generation.start.failed",
  "generation.workflow.failed",
  "generation.draft.ready",
  "other",
] as const;

export const workspaceActivityActionSchema = z.enum(workspaceActivityActions);
export const workspaceActivityCategorySchema = z.enum([
  "access",
  "catalogue",
  "asset",
  "build",
  "generation",
  "other",
]);

const actorDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((value) => !hasControlCharacter(value));
const activityCursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);

export const workspaceActivityItemSchema = z.object({
  action: workspaceActivityActionSchema,
  category: workspaceActivityCategorySchema,
  actorDisplayName: actorDisplayNameSchema.nullable(),
  createdAt: z.string().trim().min(1).max(64),
});

export const workspaceActivityResponseSchema = z.object({
  items: z.array(workspaceActivityItemSchema).max(50),
  nextCursor: activityCursorSchema.nullable(),
});

export type WorkspaceActivityAction = z.infer<
  typeof workspaceActivityActionSchema
>;
export type WorkspaceActivityCategory = z.infer<
  typeof workspaceActivityCategorySchema
>;
export type WorkspaceActivityItem = z.infer<typeof workspaceActivityItemSchema>;
export type WorkspaceActivityResponse = z.infer<
  typeof workspaceActivityResponseSchema
>;

const knownActions = new Set<string>(workspaceActivityActions);

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

export function normalizeWorkspaceActivityAction(
  action: string,
): WorkspaceActivityAction {
  return knownActions.has(action)
    ? (action as WorkspaceActivityAction)
    : "other";
}

export function workspaceActivityCategoryForAction(
  action: WorkspaceActivityAction,
): WorkspaceActivityCategory {
  if (action.startsWith("workspace.")) return "access";
  if (action.startsWith("catalogue.")) return "catalogue";
  if (action.startsWith("asset.")) return "asset";
  if (action.startsWith("build.")) return "build";
  if (action.startsWith("generation.")) return "generation";
  return "other";
}

export function safeWorkspaceActivityActorDisplayName(
  displayName: string | null,
): string | null {
  const parsed = actorDisplayNameSchema.safeParse(displayName);
  return parsed.success ? parsed.data : null;
}

export function isWorkspaceActivityCursor(value: string): boolean {
  return activityCursorSchema.safeParse(value).success;
}
