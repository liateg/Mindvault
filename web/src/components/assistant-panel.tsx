import type { FormEvent } from "react";
import { useState } from "react";
import { AssistantChrome } from "./assistant-chrome";
import { useAssistant } from "../hooks/use-assistant";

export function AssistantPanel({
  projectId,
  compact = false,
  onClose,
}: {
  projectId: string;
  compact?: boolean;
  onClose?: () => void;
}) {
  const assistant = useAssistant(projectId);
  const [grounded, setGrounded] = useState(true);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = assistant.prompt.trim();
    if (!text) return;
    void assistant.send(text);
  }

  return (
    <AssistantChrome
      variant={compact ? "panel" : "page"}
      mode="live"
      prompt={assistant.prompt}
      onPromptChange={assistant.setPrompt}
      onSubmit={onSubmit}
      submitAriaLabel="Ask assistant"
      grounded={grounded}
      onGroundedChange={setGrounded}
      status={assistant.status}
      answer={assistant.answer}
      error={assistant.error}
      submittedPrompt={assistant.submittedPrompt}
      history={assistant.history}
      onCancel={assistant.cancel}
      onClose={onClose}
    />
  );
}
