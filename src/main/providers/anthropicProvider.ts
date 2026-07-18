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

import Anthropic from "@anthropic-ai/sdk";
import type { LLMInput, LLMOutput, LLMProvider } from "./base";
import type { ConnectionTestResult } from "../../shared/types";

const DEFAULT_MAX_TOKENS = 8192;

export interface AnthropicProviderOptions {
  apiKey: string;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return "Anthropic API key is missing or invalid.";
    }
    if (error.status === 404) {
      return "Anthropic model was not found or is unavailable. Check the model name.";
    }
    return `Anthropic API error (${error.status ?? "unknown"}): ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(options: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
  }

  async generateMarkdown(input: LLMInput): Promise<LLMOutput> {
    try {
      const message = await this.client.messages.create({
        model: input.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: input.systemPrompt,
        temperature: input.temperature,
        messages: [{ role: "user", content: input.userPrompt }],
      });

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      if (!text) {
        throw new Error("Anthropic response did not contain any text content.");
      }

      return { text, raw: message };
    } catch (error) {
      throw new Error(describeError(error));
    }
  }
}

export async function testAnthropicConnection(
  apiKey: string,
  model: string,
): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return {
      ok: false,
      message: "No Anthropic API key available. Set ANTHROPIC_API_KEY in .env or paste one above.",
    };
  }
  if (!model.trim()) {
    return { ok: false, message: "Enter a model name to test." };
  }

  try {
    const client = new Anthropic({ apiKey });
    const info = await client.models.retrieve(model.trim());
    return { ok: true, message: `Connected. Model "${info.display_name}" is available.` };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}
