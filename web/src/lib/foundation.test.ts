import { afterEach, describe, expect, it, vi } from "vitest";
import { can } from "./permissions";
import { parseSseFrames, streamAsk } from "./sse";
import { isInvitationActionable } from "./format";

describe("permission capabilities", () => {
  it("matches the backend role ladder", () => {
    expect(can("read", "view")).toBe(true);
    expect(can("triage", "review")).toBe(true);
    expect(can("write", "maintain")).toBe(false);
    expect(can("admin", "admin")).toBe(true);
  });
});

describe("SSE parsing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("parses complete frames and preserves partial data", () => {
    const result = parseSseFrames(
      'event: token\ndata: {"type":"token","text":"Hello"}\n\n' +
        'event: token\ndata: {"type":"token","text":" wor',
    );

    expect(result.frames).toEqual([
      { event: "token", data: '{"type":"token","text":"Hello"}' },
    ]);
    expect(result.remainder).toContain("event: token");
  });

  it("supports CRLF event streams", () => {
    expect(parseSseFrames("event: done\r\ndata: {}\r\n\r\n").frames).toEqual([
      { event: "done", data: "{}" },
    ]);
  });

  it("cancels an in-flight stream when the abort signal fires", async () => {
    const abort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new DOMException("Aborted", "AbortError"));
          if (init?.signal?.aborted) {
            fail();
            return;
          }
          init?.signal?.addEventListener("abort", fail, { once: true });
        });
      }),
    );
    const pending = streamAsk(
      {
        projectId: "11111111-1111-1111-1111-111111111111",
        prompt: "What was approved?",
      },
      abort.signal,
    ).next();
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("invitation actionability", () => {
  it("requires a pending unexpired invitation before membership changes", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isInvitationActionable("pending", future)).toBe(true);
    expect(isInvitationActionable("accepted", future)).toBe(false);
    expect(isInvitationActionable("pending", past)).toBe(false);
  });
});
