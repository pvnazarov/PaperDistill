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

import OpenAI from "openai";
import type { LLMInput, LLMOutput, LLMProvider } from "./base";
import type { ConnectionTestResult } from "../../shared/types";

export interface OpenAIProviderOptions {
  apiKey: string;
}

function describeError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) {
    return "OpenAI API key is missing or invalid.";
  }
  if (error instanceof OpenAI.NotFoundError) {
    return "OpenAI model was not found or is unavailable. Check the model name.";
  }
  if (error instanceof OpenAI.APIError) {
    return `OpenAI API error (${error.status ?? "unknown"}): ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(options: OpenAIProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
  }

  async generateMarkdown(input: LLMInput): Promise<LLMOutput> {
    try {
      const response = await this.client.responses.create({
        model: input.model,
        instructions: input.systemPrompt,
        input: input.userPrompt,
        temperature: input.temperature,
        store: false,
      });

      const text = response.output_text;
      if (!text) {
        throw new Error("OpenAI response did not contain any text content.");
      }

      return { text, raw: response };
    } catch (error) {
      throw new Error(describeError(error));
    }
  }
}

export async function testOpenAIConnection(
  apiKey: string,
  model: string,
): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return {
      ok: false,
      message: "No OpenAI API key available. Set OPENAI_API_KEY in .env or paste one above.",
    };
  }
  if (!model.trim()) {
    return { ok: false, message: "Enter a model name to test." };
  }

  try {
    const client = new OpenAI({ apiKey });
    const info = await client.models.retrieve(model.trim());
    return { ok: true, message: `Connected. Model "${info.id}" is available.` };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}
