import assert from "node:assert/strict";
import test from "node:test";
import {
  LLM_PROMPT_LOG_BEGIN,
  LLM_PROMPT_LOG_END,
  logLlmPromptIfEnabled,
} from "../src/llm/prompt-logging.js";

test("does not log prompts unless explicitly enabled", () => {
  const originalValue = process.env.LOG_LLM_PROMPT;
  const originalLog = console.log;
  const messages: unknown[][] = [];

  try {
    console.log = (...args: unknown[]) => {
      messages.push(args);
    };

    delete process.env.LOG_LLM_PROMPT;
    logLlmPromptIfEnabled("sensitive context");
    process.env.LOG_LLM_PROMPT = "false";
    logLlmPromptIfEnabled("sensitive context");
    process.env.LOG_LLM_PROMPT = "TRUE";
    logLlmPromptIfEnabled("sensitive context");

    assert.deepEqual(messages, []);
  } finally {
    console.log = originalLog;
    if (originalValue === undefined) {
      delete process.env.LOG_LLM_PROMPT;
    } else {
      process.env.LOG_LLM_PROMPT = originalValue;
    }
  }
});

test("logs the exact prompt between clear markers when enabled", () => {
  const originalValue = process.env.LOG_LLM_PROMPT;
  const originalLog = console.log;
  const messages: unknown[][] = [];
  const prompt = "approved decision context\n\nUser request:\nBuild it";

  try {
    console.log = (...args: unknown[]) => {
      messages.push(args);
    };
    process.env.LOG_LLM_PROMPT = "true";

    logLlmPromptIfEnabled(prompt);

    assert.deepEqual(messages, [
      [`${LLM_PROMPT_LOG_BEGIN}\n${prompt}\n${LLM_PROMPT_LOG_END}`],
    ]);
  } finally {
    console.log = originalLog;
    if (originalValue === undefined) {
      delete process.env.LOG_LLM_PROMPT;
    } else {
      process.env.LOG_LLM_PROMPT = originalValue;
    }
  }
});
