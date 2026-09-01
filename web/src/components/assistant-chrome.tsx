import { AtSign, Brain, LoaderCircle, Mic, Send, Square, X } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useRef, type FormEvent } from "react";
import type { AssistantStatus, AssistantTurn } from "../hooks/use-assistant";
import { AssistantMarkdown } from "./assistant-markdown";

export const PREVIEW_USER_PROMPT = "Why did we choose Postgres for this vault?";
export const PREVIEW_ASSISTANT_REPLY =
  "We approved Postgres as the system of record so every decision stays durable and queryable. Redis remains a cache, not the source of truth — review history has to survive after the thread is gone.";

const PREVIEW_PILLS = ["34%", "56%", "44%"] as const;

export function pillsFromTurns(turns: readonly AssistantTurn[]): string[] {
  return turns
    .flatMap((turn) => {
      const promptWidth = 32 + Math.min(30, Math.round(turn.prompt.length / 3.5));
      const answerWidth = 46 + Math.min(36, Math.round(turn.answer.length / 5));
      return [`${promptWidth}%`, `${answerWidth}%`];
    })
    .slice(-8);
}

export function AssistantChrome({
  variant = "hero",
  mode = "preview",
  prompt,
  onPromptChange,
  onSubmit,
  submitAriaLabel,
  grounded = true,
  onGroundedChange,
  status = "idle",
  answer = "",
  error = null,
  submittedPrompt = "",
  history = [],
  onCancel,
  onClose,
}: {
  variant?: "hero" | "page" | "panel";
  mode?: "preview" | "live";
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitAriaLabel: string;
  grounded?: boolean;
  onGroundedChange?: (value: boolean) => void;
  status?: AssistantStatus;
  answer?: string;
  error?: string | null;
  submittedPrompt?: string;
  history?: readonly AssistantTurn[];
  onCancel?: () => void;
  onClose?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const streaming = status === "streaming";
  const emptyLive =
    mode === "live" && !submittedPrompt && !answer && !error && history.length === 0;

  useEffect(() => {
    if (mode === "preview") return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [answer, submittedPrompt, status, history.length, mode]);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (streaming) {
      onCancel?.();
      return;
    }
    onSubmit(event);
  }

  return (
    <div className={clsx("assistant-stage", `assistant-stage-${variant}`)}>
      <div className="assistant-glow" aria-hidden="true" />
      <div className="assistant-mesh" aria-hidden="true" />

      <div className={clsx("assistant-frame", emptyLive ? "is-empty" : "has-thread")}>
        {onClose ? (
          <button
            aria-label="Close assistant"
            className="assistant-close"
            type="button"
            onClick={() => {
              onCancel?.();
              onClose();
            }}
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div
          className={clsx("assistant-history", "hide-scrollbar", emptyLive && "is-empty")}
          ref={scrollerRef}
        >
          {mode === "preview" ? (
            <PreviewConversation />
          ) : emptyLive ? (
            <p className="assistant-empty">Ask about an approved decision to start.</p>
          ) : (
            <LiveConversation
              answer={answer}
              error={error}
              history={history}
              streaming={streaming}
              submittedPrompt={submittedPrompt}
            />
          )}
        </div>

        <form
          className={clsx("assistant-command", variant === "hero" && "has-badge")}
          onSubmit={onFormSubmit}
        >
          {variant === "hero" ? (
            <>
              <div className="assistant-badge-flare" aria-hidden="true" />
              <span className="assistant-badge" aria-hidden="true">
                <Brain className="size-4" strokeWidth={2.25} />
              </span>
            </>
          ) : null}

          <div className="assistant-command-main">
            <input
              aria-label="Ask Mindvault"
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Ask about a decision, press '/' for prompt"
              value={prompt}
            />
            <button
              aria-label={streaming ? "Cancel request" : submitAriaLabel}
              className="assistant-send"
              type={streaming ? "button" : "submit"}
              onClick={streaming ? onCancel : undefined}
            >
              {streaming ? <Square className="size-3.5" /> : <Send className="size-4" />}
            </button>
          </div>

          <div className="assistant-command-bar">
            <div className="assistant-command-tools" aria-hidden="true">
              <span>%</span>
              <span className="assistant-command-divider" />
              <AtSign className="size-3.5" />
              <span className="assistant-command-divider" />
              <Mic className="size-3.5" />
            </div>
            <button
              aria-label="Context"
              aria-pressed={grounded}
              className={grounded ? "assistant-toggle is-on" : "assistant-toggle"}
              onClick={() => onGroundedChange?.(!grounded)}
              type="button"
            >
              <span>Context</span>
              <span className="assistant-switch" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewConversation() {
  return (
    <>
      <MessagePills widths={PREVIEW_PILLS} />
      <div className="assistant-transcript">
        <p className="assistant-bubble is-user is-end">{PREVIEW_USER_PROMPT}</p>
        <div className="assistant-bubble is-assistant is-start">
          <AssistantMarkdown>{PREVIEW_ASSISTANT_REPLY}</AssistantMarkdown>
        </div>
      </div>
    </>
  );
}

function LiveConversation({
  history,
  submittedPrompt,
  answer,
  error,
  streaming,
}: {
  history: readonly AssistantTurn[];
  submittedPrompt: string;
  answer: string;
  error: string | null;
  streaming: boolean;
}) {
  return (
    <>
      {history.length > 0 ? <MessagePills widths={pillsFromTurns(history)} /> : null}
      <div className="assistant-transcript" aria-live="polite">
        {submittedPrompt ? (
          <p className="assistant-bubble is-user is-end">{submittedPrompt}</p>
        ) : null}
        {streaming && !answer ? (
          <p className="assistant-bubble is-assistant is-start is-pending">
            <LoaderCircle className="size-4 animate-spin" />
            Waiting for tokens
          </p>
        ) : answer ? (
          <div className="assistant-bubble is-assistant is-start">
            <AssistantMarkdown>{answer}</AssistantMarkdown>
          </div>
        ) : null}
        {error ? <p className="assistant-error is-start">{error}</p> : null}
      </div>
    </>
  );
}

function MessagePills({ widths }: { widths: readonly string[] }) {
  return (
    <div className="assistant-pills" aria-hidden="true">
      {widths.map((width, index) => (
        <div className="assistant-pill" key={`${width}-${index}`} style={{ width }} />
      ))}
    </div>
  );
}
