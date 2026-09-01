import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { queryClient } from "../lib/query";

const NativeRequest = globalThis.Request;
globalThis.Request = class Request extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (!init?.signal) {
      super(input, init);
      return;
    }
    try {
      super(input, init);
    } catch {
      const { signal: _signal, ...rest } = init;
      super(input, rest);
    }
  }
} as typeof NativeRequest;

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
  cleanup();
});
