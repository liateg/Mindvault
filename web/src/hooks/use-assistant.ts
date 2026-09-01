import { useCallback, useEffect, useRef, useState } from "react";
import { streamAsk } from "../lib/sse";

export type AssistantStatus =
  | "idle"
  | "streaming"
  | "complete"
  | "timeout"
  | "aborted"
  | "error";

export type AssistantTurn = {
  prompt: string;
  answer: string;
};

export function useAssistant(projectId: string | undefined) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [history, setHistory] = useState<AssistantTurn[]>([]);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnRef = useRef({ prompt: "", answer: "", error: null as string | null });

  turnRef.current = { prompt: submittedPrompt, answer, error };

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    setHistory([]);
    setSubmittedPrompt("");
    setAnswer("");
    setError(null);
    setStatus("idle");
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [projectId]);

  const send = useCallback(
    async (nextPrompt?: string) => {
      if (!projectId) return;
      const text = (nextPrompt ?? prompt).trim();
      if (!text) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const previous = turnRef.current;
      if (previous.prompt) {
        setHistory((current) => [
          ...current,
          { prompt: previous.prompt, answer: previous.answer || previous.error || "" },
        ]);
      }

      setSubmittedPrompt(text);
      setPrompt("");
      setAnswer("");
      setError(null);
      setStatus("streaming");

      try {
        for await (const event of streamAsk(
          { projectId, prompt: text },
          controller.signal,
        )) {
          if (event.type === "token") {
            setAnswer((current) => current + event.text);
          } else if (event.type === "complete") {
            setAnswer(event.text);
            setStatus("complete");
          } else if (event.type === "error") {
            setError(event.message);
            if (event.responseStatus === "TIMEOUT") setStatus("timeout");
            else if (event.responseStatus === "ABORTED") setStatus("aborted");
            else setStatus("error");
          }
        }
        if (controller.signal.aborted && abortRef.current === controller) {
          setStatus("aborted");
        }
      } catch (caught) {
        if (
          controller.signal.aborted ||
          (caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setStatus("aborted");
          return;
        }
        setStatus("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to reach the assistant",
        );
      }
    },
    [projectId, prompt],
  );

  return {
    prompt,
    setPrompt,
    answer,
    submittedPrompt,
    history,
    status,
    error,
    send,
    cancel,
  };
}
