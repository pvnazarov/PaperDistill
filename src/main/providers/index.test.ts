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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProvider } from "./index";
import { AnthropicProvider } from "./anthropicProvider";
import { OpenAIProvider } from "./openaiProvider";
import { OllamaProvider } from "./ollamaProvider";

describe("createProvider", () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalOpenaiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    process.env.OPENAI_API_KEY = originalOpenaiKey;
  });

  it("throws a clear error for Anthropic when no key is available", () => {
    expect(() => createProvider({ providerName: "anthropic", model: "claude-sonnet-4-5" })).toThrow(
      /Missing Anthropic API key/,
    );
  });

  it("throws a clear error for OpenAI when no key is available", () => {
    expect(() => createProvider({ providerName: "openai", model: "gpt-4o" })).toThrow(
      /Missing OpenAI API key/,
    );
  });

  it("uses the session-provided key over a missing env var", () => {
    expect(() =>
      createProvider({ providerName: "anthropic", model: "claude-sonnet-4-5", apiKey: "session-key" }),
    ).not.toThrow();
  });

  it("falls back to the env var when no session key is provided", () => {
    process.env.OPENAI_API_KEY = "env-key";
    expect(() => createProvider({ providerName: "openai", model: "gpt-4o" })).not.toThrow();
  });

  it("constructs the matching provider implementation for each provider name", () => {
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.OPENAI_API_KEY = "k";
    expect(createProvider({ providerName: "anthropic", model: "m" })).toBeInstanceOf(AnthropicProvider);
    expect(createProvider({ providerName: "openai", model: "m" })).toBeInstanceOf(OpenAIProvider);
    expect(createProvider({ providerName: "ollama", model: "m" })).toBeInstanceOf(OllamaProvider);
  });

  it("does not require an API key for Ollama", () => {
    expect(() => createProvider({ providerName: "ollama", model: "llama3.1" })).not.toThrow();
  });
});
