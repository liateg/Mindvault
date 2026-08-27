import {
  injectApprovedDecisionContext,
  type ApprovedDecisionContext,
} from "../llm/decision-context.js";
import {
  rejectUnknownKeys,
  requiredText,
  requireObject,
  uuidParam,
} from "./validation.js";

export type AskContextDependencies = {
  requireAccess: (
    projectId: string,
    userId: string,
    permission: "view",
  ) => Promise<unknown>;
  listApprovedDecisions: (
    projectId: string,
  ) => Promise<ApprovedDecisionContext[]>;
};

export function parseAskBody(value: unknown): {
  projectId: string;
  prompt: string;
} {
  const body = requireObject(value);
  rejectUnknownKeys(body, ["projectId", "prompt"]);
  return {
    projectId: uuidParam(body.projectId, "projectId"),
    prompt: requiredText(body, "prompt"),
  };
}

export async function prepareProjectAskPrompt(
  projectId: string,
  userId: string,
  prompt: string,
  dependencies: AskContextDependencies,
): Promise<string> {
  await dependencies.requireAccess(projectId, userId, "view");
  const decisions = await dependencies.listApprovedDecisions(projectId);
  return injectApprovedDecisionContext(prompt, decisions);
}
