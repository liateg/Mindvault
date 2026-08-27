export const LLM_PROMPT_LOG_BEGIN = "----- BEGIN LLM PROMPT -----";
export const LLM_PROMPT_LOG_END = "----- END LLM PROMPT -----";

export function logLlmPromptIfEnabled(prompt: string): void {
  if (process.env.LOG_LLM_PROMPT !== "true") return;

  console.log(`${LLM_PROMPT_LOG_BEGIN}\n${prompt}\n${LLM_PROMPT_LOG_END}`);
}
