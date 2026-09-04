import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  chunkNote,
  sectionChunkId,
  shouldSkipRewrite,
  sourceHash,
  type NoteToChunk,
  type PersistableChunk,
} from "../src/ingest/chunk.js";
import {
  ingestChunks,
  type ChunkRepository,
} from "../src/ingest/job.js";

const projectId = "11111111-1111-4111-8111-111111111111";

function decisionId(n: number): string {
  return `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;
}

function headingProposal(
  sectionCount: number,
  token: string,
  repeats: number,
): string {
  return Array.from({ length: sectionCount }, (_, index) => {
    const heading = `## Section ${index + 1} ${token}`;
    const body = `${token}-${index + 1} `.repeat(repeats);
    return `${heading}\n${body}`;
  }).join("\n\n");
}

function note(
  n: number,
  overrides: Partial<NoteToChunk> = {},
): NoteToChunk {
  return {
    id: decisionId(n),
    projectId,
    title: "title",
    proposalContent: "proposal",
    llmReasoningSummary: null,
    ...overrides,
  };
}

class MemoryRepo implements ChunkRepository {
  notes: NoteToChunk[];
  store = new Map<string, PersistableChunk[]>();
  replaceCalls = 0;

  constructor(notes: NoteToChunk[]) {
    this.notes = notes;
  }

  async listNotes(filterProjectId?: string) {
    return this.notes.filter(
      (item) => filterProjectId === undefined || item.projectId === filterProjectId,
    );
  }

  async listChunksByDecisionIds(decisionIds: readonly string[]) {
    const byDecision = new Map<string, { sourceHash: string }[]>();
    for (const id of decisionIds) {
      const chunks = this.store.get(id);
      if (chunks !== undefined) {
        byDecision.set(
          id,
          chunks.map((chunk) => ({ sourceHash: chunk.sourceHash })),
        );
      }
    }
    return byDecision;
  }

  async replaceChunks(id: string, chunks: readonly PersistableChunk[]) {
    this.replaceCalls += 1;
    this.store.set(id, [...chunks]);
  }
}

test("chunkNote keeps a small proposal as one full chunk keyed by the parent id", () => {
  const item = note(1, { proposalContent: "Keep the cache for 30 seconds." });
  const chunks = chunkNote(item);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.chunkKind, "full");
  assert.equal(chunks[0]?.chunkId, item.id);
  assert.equal(chunks[0]?.proposalSlice, item.proposalContent);
  assert.equal(chunks[0]?.sectionIndex, null);
  assert.equal(chunks[0]?.sourceHash, sourceHash(item.proposalContent));
});

test("chunkNote assigns 1-based section ids and does not duplicate parent title", () => {
  const item = note(2, {
    title: "Huge RFC",
    proposalContent: headingProposal(8, "payload", 180),
  });
  const chunks = chunkNote(item);

  assert.ok(chunks.length > 1);
  for (const [index, chunk] of chunks.entries()) {
    assert.equal(chunk.chunkKind, "section");
    assert.equal(chunk.chunkId, sectionChunkId(item.id, index + 1));
    assert.equal(chunk.sectionIndex, index + 1);
    assert.equal(chunk.sectionCount, chunks.length);
    assert.equal(chunk.proposalSlice.includes("Huge RFC"), false);
    assert.ok(chunk.proposalSlice.length > 0);
  }
});

test("shouldSkipRewrite is true only when hash and row count match", () => {
  const item = note(3, { proposalContent: headingProposal(4, "skip", 180) });
  const next = chunkNote(item);
  const existing = next.map((chunk) => ({ sourceHash: chunk.sourceHash }));

  assert.equal(shouldSkipRewrite(existing, next), true);
  assert.equal(shouldSkipRewrite([], next), false);
  assert.equal(shouldSkipRewrite(existing.slice(0, 1), next), false);
  assert.equal(
    shouldSkipRewrite(
      existing.map((row) => ({ sourceHash: `${row.sourceHash}-stale` })),
      next,
    ),
    false,
  );
});

test("ingest skips when source hash matches and replaces leftover sections on change", async () => {
  const long = note(4, {
    proposalContent: headingProposal(8, "payload", 180),
  });
  const repo = new MemoryRepo([long]);

  const first = await ingestChunks({ repo });
  const stored = repo.store.get(long.id) ?? [];
  assert.equal(first.rewritten, 1);
  assert.equal(first.skipped, 0);
  assert.ok(stored.length > 1);
  assert.ok(stored.some((chunk) => chunk.chunkId === `${long.id}#section:7`));
  assert.equal(repo.replaceCalls, 1);

  const second = await ingestChunks({ repo });
  assert.equal(second.rewritten, 0);
  assert.equal(second.skipped, 1);
  assert.equal(repo.replaceCalls, 1);

  long.proposalContent = headingProposal(2, "payload", 180);
  const third = await ingestChunks({ repo });
  const replaced = repo.store.get(long.id) ?? [];
  assert.equal(third.rewritten, 1);
  assert.equal(third.skipped, 0);
  assert.equal(repo.replaceCalls, 2);
  assert.equal(replaced.length, 2);
  assert.deepEqual(
    replaced.map((chunk) => chunk.chunkId),
    [`${long.id}#section:1`, `${long.id}#section:2`],
  );
  assert.equal(
    replaced.some((chunk) => chunk.chunkId.endsWith("#section:7")),
    false,
  );
});

test("migration creates decision_chunk with proposal slices and source hash", async () => {
  const sql = await readFile(
    new URL("../drizzle/0004_misty_mercury.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "decision_chunk"/);
  assert.match(sql, /"proposal_slice" text NOT NULL/);
  assert.match(sql, /"source_hash" text NOT NULL/);
  assert.match(sql, /decision_chunk_decision_id_decision_id_fk/);
  assert.match(sql, /ON DELETE cascade/);
});
