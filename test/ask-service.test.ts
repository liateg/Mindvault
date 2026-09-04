import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAskBody,
  prepareProjectAskPrompt,
} from "../src/api/ask-service.js";
import { chunkNote, toPersistedDecisionChunk } from "../src/ingest/chunk.js";

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
          id: "11111111-1111-4111-8111-111111111111",
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
  assert.match(result.text, /Scoped decision/);
  assert.match(result.text, /THIS project only/);
  assert.match(result.text, /output ONLY this refusal and nothing else/);
  assert.match(
    result.text,
    /Questions about THIS project's staffing, deploy, SLA, on-call, regions, ops, or process are in-scope/,
  );
  assert.match(
    result.text,
    /There isn't enough recorded data about this decision\./,
  );
  assert.match(
    result.text,
    /My job is this team's decisions and recorded context\. I'm bound to that\./,
  );
  assert.equal(result.truncatedChars, 0);
  assert.equal(result.estimatedTruncatedTokens, 0);
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

test("still injects project-scope instructions when the exact project has no approvals", async () => {
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

  assert.equal(result.truncatedChars, 0);
  assert.equal(result.estimatedTruncatedTokens, 0);
  assert.match(result.text, /THIS project only/);
  assert.match(result.text, /No approved decisions are recorded/);
  assert.match(result.text, /output ONLY this refusal and nothing else/);
  assert.match(
    result.text,
    /Questions about THIS project's staffing, deploy, SLA, on-call, regions, ops, or process are in-scope/,
  );
  assert.match(
    result.text,
    /There isn't enough recorded data about this decision\./,
  );
  assert.match(
    result.text,
    /My job is this team's decisions and recorded context\. I'm bound to that\./,
  );
  assert.match(result.text, /User request:\nplain question$/);
});

test("packs persisted chunks from listApprovedDecisions instead of re-splitting", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const proposal = Array.from({ length: 8 }, (_, index) => {
    const heading = `## Section ${index + 1} payload`;
    const body = `payload-${index + 1} `.repeat(180);
    return `${heading}\n${body}`;
  }).join("\n\n");
  const persistedChunks = chunkNote({
    id,
    projectId,
    title: "Huge RFC",
    proposalContent: proposal,
    llmReasoningSummary: null,
  }).map(toPersistedDecisionChunk);

  const result = await prepareProjectAskPrompt(projectId, userId, "question", {
    requireAccess: async () => undefined,
    listApprovedDecisions: async () => [
      {
        id,
        title: "Huge RFC",
        proposalContent: proposal,
        llmReasoningSummary: null,
        persistedChunks,
      },
    ],
  });

  assert.ok(persistedChunks.length > 1);
  assert.equal(result.chunks[0]?.chunkKind, "section");
  assert.equal(result.chunks[0]?.chunkId, `${id}#section:1`);
  assert.match(result.text, /section 1 of/);
  assert.match(result.text, /Title: "Huge RFC"/);
});
