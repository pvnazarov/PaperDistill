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

import { beforeEach, describe, expect, it, vi } from "vitest";

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

  class OpenAI {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static NotFoundError = NotFoundError;
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
});
