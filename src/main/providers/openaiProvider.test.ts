/*
 * PaperDistill
 * Copyright (c) 2026 Petr Nazarov, Luxembourg Institute of Health (LIH)
 *
 * Released under the MIT License.
 * Developed with significant assistance from Anthropic Claude Code.
 * Responsibility for any bugs remains under active investigation.
 *
 * See LICENSE for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  class APIError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  class AuthenticationError extends APIError {}
  class NotFoundError extends APIError {}
  class RateLimitError extends APIError {
    code?: string;
    headers?: Headers;
    constructor(message: string, code?: string, headers?: Headers) {
      super(message, 429);
      this.code = code;
      this.headers = headers;
    }
  }

  class OpenAI {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static NotFoundError = NotFoundError;
    static RateLimitError = RateLimitError;
    responses = { create: mockCreate };
    constructor(_opts: unknown) {}
  }

  return { default: OpenAI };
});

import OpenAIMocked from "openai";
import { OpenAIProvider } from "./openaiProvider";

describe("OpenAIProvider", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns the generated text on a valid response", async () => {
    mockCreate.mockResolvedValueOnce({ output_text: "# Hello World" });
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    const result = await provider.generateMarkdown({
      systemPrompt: "sys",
      userPrompt: "user",
      model: "gpt-4o",
    });

    expect(result.text).toBe("# Hello World");
  });

  it("produces a clear error when the API key is missing or invalid", async () => {
    mockCreate.mockRejectedValueOnce(new OpenAIMocked.AuthenticationError("invalid_api_key"));
    const provider = new OpenAIProvider({ apiKey: "bad-key" });

    await expect(
      provider.generateMarkdown({ systemPrompt: "sys", userPrompt: "user", model: "gpt-4o" }),
    ).rejects.toThrow("OpenAI API key is missing or invalid.");
  });

  it("produces a clear error when the model is unavailable", async () => {
    mockCreate.mockRejectedValueOnce(new OpenAIMocked.NotFoundError("model_not_found"));
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    await expect(
      provider.generateMarkdown({ systemPrompt: "sys", userPrompt: "user", model: "nonexistent-model" }),
    ).rejects.toThrow("OpenAI model was not found or is unavailable. Check the model name.");
  });

  it("wraps other API errors with their status code", async () => {
    mockCreate.mockRejectedValueOnce(new OpenAIMocked.APIError("rate limited", 429));
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    await expect(
      provider.generateMarkdown({ systemPrompt: "sys", userPrompt: "user", model: "gpt-4o" }),
    ).rejects.toThrow("OpenAI API error (429)");
  });

  it("throws a clear error when the response has no text content", async () => {
    mockCreate.mockResolvedValueOnce({ output_text: "" });
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    await expect(
      provider.generateMarkdown({ systemPrompt: "sys", userPrompt: "user", model: "gpt-4o" }),
    ).rejects.toThrow("OpenAI response did not contain any text content.");
  });

  describe("rate-limit retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries on rate_limit_exceeded and succeeds once the limit clears", async () => {
      mockCreate
        .mockRejectedValueOnce(new OpenAIMocked.RateLimitError("rate limited", "rate_limit_exceeded"))
        .mockRejectedValueOnce(new OpenAIMocked.RateLimitError("rate limited", "rate_limit_exceeded"))
        .mockResolvedValueOnce({ output_text: "# Recovered" });
      const provider = new OpenAIProvider({ apiKey: "test-key" });

      const resultPromise = provider.generateMarkdown({
        systemPrompt: "sys",
        userPrompt: "user",
        model: "gpt-4o",
      });
      await vi.advanceTimersByTimeAsync(60000);
      const result = await resultPromise;

      expect(result.text).toBe("# Recovered");
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it("does not retry on insufficient_quota", async () => {
      mockCreate.mockRejectedValueOnce(
        new OpenAIMocked.RateLimitError("no quota", "insufficient_quota"),
      );
      const provider = new OpenAIProvider({ apiKey: "test-key" });

      await expect(
        provider.generateMarkdown({ systemPrompt: "sys", userPrompt: "user", model: "gpt-4o" }),
      ).rejects.toThrow("OpenAI quota exhausted (insufficient_quota)");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("gives up after repeated rate-limit errors", async () => {
      mockCreate.mockRejectedValue(
        new OpenAIMocked.RateLimitError("rate limited", "rate_limit_exceeded"),
      );
      const provider = new OpenAIProvider({ apiKey: "test-key" });

      const resultPromise = provider.generateMarkdown({
        systemPrompt: "sys",
        userPrompt: "user",
        model: "gpt-4o",
      });
      resultPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10 * 60000);

      await expect(resultPromise).rejects.toThrow(
        "OpenAI rate limit exceeded after repeated retries",
      );
      expect(mockCreate).toHaveBeenCalledTimes(6);
    });

    it("honors the Retry-After header instead of exponential backoff", async () => {
      const headers = new Headers({ "retry-after": "5" });
      mockCreate
        .mockRejectedValueOnce(
          new OpenAIMocked.RateLimitError("rate limited", "rate_limit_exceeded", headers),
        )
        .mockResolvedValueOnce({ output_text: "# Recovered" });
      const provider = new OpenAIProvider({ apiKey: "test-key" });

      const resultPromise = provider.generateMarkdown({
        systemPrompt: "sys",
        userPrompt: "user",
        model: "gpt-4o",
      });
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.text).toBe("# Recovered");
    });
  });
});
