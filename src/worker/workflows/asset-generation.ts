import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

type PlaceholderParams = {
  workspaceId: string;
};

type PlaceholderResult = {
  status: "placeholder";
  workspaceId: string;
};

export class AssetGenerationWorkflow extends WorkflowEntrypoint<
  Env,
  PlaceholderParams
> {
  override async run(
    event: Readonly<WorkflowEvent<PlaceholderParams>>,
    step: WorkflowStep,
  ): Promise<PlaceholderResult> {
    return step.do("placeholder-generation", () =>
      Promise.resolve({
        status: "placeholder",
        workspaceId: event.payload.workspaceId,
      }),
    );
  }
}
