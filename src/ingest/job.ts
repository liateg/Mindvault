import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import {
  chunkNote,
  shouldSkipRewrite,
  type NoteToChunk,
  type PersistableChunk,
} from "./chunk.js";
import { embedChunks } from "./embed.js";

export type ChunkRepository = {
  listNotes(projectId?: string): Promise<NoteToChunk[]>;
  listChunksByDecisionIds(
    decisionIds: readonly string[],
  ): Promise<Map<string, { sourceHash: string }[]>>;
  replaceChunks(
    decisionId: string,
    chunks: readonly PersistableChunk[],
  ): Promise<void>;
};

export type IngestResult = {
  notes: number;
  skipped: number;
  rewritten: number;
  chunksWritten: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIngestArgs(
  argv: readonly string[],
): { projectId?: string } {
  const eqFlag = argv.find((arg) => arg.startsWith("--projectId="));
  if (eqFlag !== undefined) {
    return { projectId: requireUuid(eqFlag.slice("--projectId=".length)) };
  }
  const flagIndex = argv.indexOf("--projectId");
  if (flagIndex >= 0) {
    return { projectId: requireUuid(argv[flagIndex + 1]) };
  }
  return {};
}

export async function ingestChunks(
  options: { projectId?: string; repo?: ChunkRepository } = {},
): Promise<IngestResult> {
  const repo = options.repo ?? (await createPgRepository());
  const notes = await repo.listNotes(options.projectId);
  const existing = await repo.listChunksByDecisionIds(notes.map((note) => note.id));

  let skipped = 0;
  let rewritten = 0;
  let chunksWritten = 0;
  const written: PersistableChunk[] = [];

  for (const note of notes) {
    const next = chunkNote(note);
    const current = existing.get(note.id) ?? [];
    if (shouldSkipRewrite(current, next)) {
      skipped += 1;
      continue;
    }
    await repo.replaceChunks(note.id, next);
    rewritten += 1;
    chunksWritten += next.length;
    written.push(...next);
  }

  await embedChunks(written);

  return {
    notes: notes.length,
    skipped,
    rewritten,
    chunksWritten,
  };
}

async function createPgRepository(): Promise<ChunkRepository> {
  const { db } = await import("../db/index.js");
  const { decision, decisionChunk } = await import("../db/schema.js");

  return {
    async listNotes(projectId) {
      const query = db
        .select({
          id: decision.id,
          projectId: decision.projectId,
          title: decision.title,
          proposalContent: decision.proposalContent,
          llmReasoningSummary: decision.llmReasoningSummary,
        })
        .from(decision);
      const rows =
        projectId === undefined
          ? await query
          : await query.where(eq(decision.projectId, projectId));
      return rows;
    },

    async listChunksByDecisionIds(decisionIds) {
      const byDecision = new Map<string, { sourceHash: string }[]>();
      if (decisionIds.length === 0) {
        return byDecision;
      }
      const rows = await db
        .select({
          decisionId: decisionChunk.decisionId,
          sourceHash: decisionChunk.sourceHash,
        })
        .from(decisionChunk)
        .where(inArray(decisionChunk.decisionId, [...decisionIds]));
      for (const row of rows) {
        const list = byDecision.get(row.decisionId) ?? [];
        list.push({ sourceHash: row.sourceHash });
        byDecision.set(row.decisionId, list);
      }
      return byDecision;
    },

    async replaceChunks(decisionId, chunks) {
      await db.transaction(async (tx) => {
        await tx
          .delete(decisionChunk)
          .where(eq(decisionChunk.decisionId, decisionId));
        if (chunks.length === 0) {
          return;
        }
        await tx.insert(decisionChunk).values(
          chunks.map((chunk) => ({
            id: chunk.chunkId,
            decisionId: chunk.decisionId,
            projectId: chunk.projectId,
            chunkKind: chunk.chunkKind,
            sectionIndex: chunk.sectionIndex,
            sectionCount: chunk.sectionCount,
            proposalSlice: chunk.proposalSlice,
            sourceHash: chunk.sourceHash,
          })),
        );
      });
    },
  };
}

function requireUuid(value: string | undefined): string {
  if (value === undefined || !UUID_RE.test(value)) {
    throw new Error("--projectId must be a valid UUID");
  }
  return value;
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return (
      path.normalize(fileURLToPath(import.meta.url)) ===
      path.normalize(path.resolve(entry))
    );
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const result = await ingestChunks(parseIngestArgs(process.argv.slice(2)));
  console.log(
    `Ingested ${result.notes} notes (${result.rewritten} rewritten, ${result.skipped} unchanged, ${result.chunksWritten} chunks). Embeddings: skipped (Day 11).`,
  );
}

if (isCliEntry()) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const { pool } = await import("../db/index.js");
      await pool.end();
    });
}
