import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAskBody,
  prepareProjectAskPrompt,
} from "../src/api/ask-service.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const userId = "user-1";

test("requires the exact projectId UUID and prompt body contract", () => {
  assert.deepEqual(parseAskBody({ projectId, prompt: " question " }), {
    projectId,
    prompt: "question",
  });
  assert.throws(
    () => parseAskBody({ projectId: "not-a-uuid", prompt: "question" }),
    /projectId must be a valid UUID/,
  );
  assert.throws(
    () => parseAskBody({ projectId, prompt: "question", extra: true }),
    /Unknown field: extra/,
  );
});

test("authorizes view access before loading exact-project decisions", async () => {
  const calls: string[] = [];
  const result = await prepareProjectAskPrompt(projectId, userId, "question", {
    requireAccess: async (receivedProjectId, receivedUserId, permission) => {
      calls.push(`access:${receivedProjectId}:${receivedUserId}:${permission}`);
    },
    listApprovedDecisions: async (receivedProjectId) => {
      calls.push(`decisions:${receivedProjectId}`);
      return [
        {
          title: "Scoped decision",
          proposalContent: "Only this project was queried.",
          llmReasoningSummary: null,
        },
      ];
    },
  });

  assert.deepEqual(calls, [
    `access:${projectId}:${userId}:view`,
    `decisions:${projectId}`,
  ]);
  assert.match(result, /Scoped decision/);
});

test("does not query decisions when project authorization fails", async () => {
  let queried = false;
  const denied = new Error("Insufficient project permission");

  await assert.rejects(
    prepareProjectAskPrompt(projectId, userId, "question", {
      requireAccess: async () => {
        throw denied;
      },
      listApprovedDecisions: async () => {
        queried = true;
        return [];
      },
    }),
    denied,
  );
  assert.equal(queried, false);
});

test("uses no injected context when the exact project has no approvals", async () => {
  const result = await prepareProjectAskPrompt(
    projectId,
    userId,
    "plain question",
    {
      requireAccess: async () => undefined,
      listApprovedDecisions: async (receivedProjectId) => {
        assert.equal(receivedProjectId, projectId);
        return [];
      },
    },
  );

  assert.equal(result, "plain question");
});
