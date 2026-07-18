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

import { describe, expect, it } from "vitest";
import { MockProvider } from "./mockProvider";
import type { LLMProvider } from "./base";

describe("MockProvider", () => {
  it("implements the LLMProvider interface and returns deterministic Markdown", async () => {
    const provider: LLMProvider = new MockProvider();

    const result = await provider.generateMarkdown({
      systemPrompt: "You are a precise scientific paper extraction assistant.",
      userPrompt: "Extract the title.",
      model: "test-model",
    });

    expect(result.text).toContain("# Mock Extraction");
    expect(result.text).toContain("test-model");
    expect(result.text).toContain("Extract the title.".length.toString());
  });

  it("reflects the prompt length so different inputs produce different output", async () => {
    const provider = new MockProvider();
    const short = await provider.generateMarkdown({
      systemPrompt: "sys",
      userPrompt: "short",
      model: "m",
    });
    const long = await provider.generateMarkdown({
      systemPrompt: "sys",
      userPrompt: "a much longer user prompt than the other one",
      model: "m",
    });

    expect(short.text).not.toBe(long.text);
  });
});
