import { createHash } from "node:crypto";

export const MIN_SECTION_MERGE_CHARS = 1_000;
export const MAX_SECTION_CHARS = 2_000;

const MARKDOWN_HEADING_SPLIT = /\n(?=#{1,6}[ \t])/;
const PARAGRAPH_SPLIT = /\n\n+/;
const SENTENCE_SPLIT = /(?<=[.!?])(?:[ \t]+|\n+)/;

export type DecisionChunkKind = "full" | "section";

export type DecisionChunk = {
  decisionId: string;
  chunkId: string;
  chunkKind: DecisionChunkKind;
  sectionIndex?: number;
  sectionCount?: number;
  text: string;
};

export type NoteToChunk = {
  id: string;
  projectId: string;
  title: string;
  proposalContent: string;
  llmReasoningSummary: string | null;
};

export type PersistableChunk = {
  chunkId: string;
  decisionId: string;
  projectId: string;
  chunkKind: DecisionChunkKind;
  sectionIndex: number | null;
  sectionCount: number | null;
  proposalSlice: string;
  sourceHash: string;
};

export type PersistedDecisionChunk = {
  chunkId: string;
  chunkKind: DecisionChunkKind;
  sectionIndex?: number;
  sectionCount?: number;
  proposalSlice: string;
};

export function sectionChunkId(decisionId: string, sectionIndex: number): string {
  return `${decisionId}#section:${sectionIndex}`;
}

export function sourceHash(proposalContent: string): string {
  return createHash("sha256").update(proposalContent).digest("hex");
}

export function splitProposalIntoSections(
  proposal: string,
  maxSectionChars = MAX_SECTION_CHARS,
): string[] {
  const text = proposal.replace(/\r\n/g, "\n").trim();
  if (text.length === 0) {
    return [""];
  }

  const units = splitRecursively(text, maxSectionChars);
  return mergeSmallAdjacent(units, MIN_SECTION_MERGE_CHARS, maxSectionChars);
}

export function chunkNote(note: NoteToChunk): PersistableChunk[] {
  const hash = sourceHash(note.proposalContent);
  const sections = splitProposalIntoSections(note.proposalContent);
  if (sections.length <= 1) {
    return [
      {
        chunkId: note.id,
        decisionId: note.id,
        projectId: note.projectId,
        chunkKind: "full",
        sectionIndex: null,
        sectionCount: null,
        proposalSlice: sections[0] ?? "",
        sourceHash: hash,
      },
    ];
  }

  return sections.map((proposalSlice, index) => ({
    chunkId: sectionChunkId(note.id, index + 1),
    decisionId: note.id,
    projectId: note.projectId,
    chunkKind: "section" as const,
    sectionIndex: index + 1,
    sectionCount: sections.length,
    proposalSlice,
    sourceHash: hash,
  }));
}

export function toPersistedDecisionChunk(
  chunk: PersistableChunk,
): PersistedDecisionChunk {
  const persisted: PersistedDecisionChunk = {
    chunkId: chunk.chunkId,
    chunkKind: chunk.chunkKind,
    proposalSlice: chunk.proposalSlice,
  };
  if (chunk.sectionIndex !== null) {
    persisted.sectionIndex = chunk.sectionIndex;
  }
  if (chunk.sectionCount !== null) {
    persisted.sectionCount = chunk.sectionCount;
  }
  return persisted;
}

export function shouldSkipRewrite(
  existing: readonly { sourceHash: string }[],
  next: readonly PersistableChunk[],
): boolean {
  const hash = next[0]?.sourceHash;
  if (existing.length === 0 || next.length === 0 || hash === undefined) {
    return false;
  }
  if (existing.length !== next.length) {
    return false;
  }
  return existing.every((row) => row.sourceHash === hash);
}

function splitRecursively(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  for (const separator of [
    MARKDOWN_HEADING_SPLIT,
    PARAGRAPH_SPLIT,
    SENTENCE_SPLIT,
  ]) {
    const parts = text
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length > 1) {
      return parts.flatMap((part) => splitRecursively(part, maxChars));
    }
  }

  return splitAtWordBoundary(text, maxChars);
}

function splitAtWordBoundary(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    let cut = window.lastIndexOf(" ");
    if (cut < 1) {
      cut = maxChars;
    }
    const piece = remaining.slice(0, cut).trim();
    if (piece.length === 0) {
      chunks.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars).trim();
      continue;
    }
    chunks.push(piece);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

function mergeSmallAdjacent(
  units: readonly string[],
  minChars: number,
  maxChars: number,
): string[] {
  const packed: string[] = [];
  let current = "";

  for (const unit of units) {
    if (unit.length > maxChars) {
      if (current.length > 0) {
        packed.push(current);
        current = "";
      }
      packed.push(...splitAtWordBoundary(unit, maxChars));
      continue;
    }
    const candidate = current.length === 0 ? unit : `${current}\n\n${unit}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      packed.push(current);
    }
    current = unit;
  }
  if (current.length > 0) {
    packed.push(current);
  }

  const merged: string[] = [];
  for (const chunk of packed) {
    const previous = merged.at(-1);
    if (
      previous !== undefined &&
      (previous.length < minChars || chunk.length < minChars) &&
      `${previous}\n\n${chunk}`.length <= maxChars
    ) {
      merged[merged.length - 1] = `${previous}\n\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged.length > 0 ? merged : [""];
}
