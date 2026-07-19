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

import OpenAI, { type RateLimitError } from "openai";
import type { LLMInput, LLMOutput, LLMProvider } from "./base";
import type { ConnectionTestResult } from "../../shared/types";

// Mirrors Anthropic's DEFAULT_MAX_TOKENS: bounds any single response so a
// runaway generation can't consume an outsized share of the TPM budget.
const MAX_OUTPUT_TOKENS = 8192;

const MAX_RATE_LIMIT_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

export interface OpenAIProviderOptions {
  apiKey: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rate-limit-only backoff: honors the Retry-After header when OpenAI sends one, otherwise exponential + jitter. */
function backoffDelayMs(attempt: number, error: RateLimitError): number {
  const retryAfterHeader = error.headers?.get?.("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return exponential + Math.random() * exponential * 0.25;
}

/**
 * Retries only on HTTP 429 with code "rate_limit_exceeded" (transient, RPM/TPM throttling).
 * "insufficient_quota" is a billing/quota wall that retrying can never fix, so it fails immediately.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error instanceof OpenAI.RateLimitError;
      const isQuotaExhausted = isRateLimit && error.code === "insufficient_quota";
      if (!isRateLimit || isQuotaExhausted || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }
      await sleep(backoffDelayMs(attempt, error));
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) {
    return "OpenAI API key is missing or invalid.";
  }
  if (error instanceof OpenAI.NotFoundError) {
    return "OpenAI model was not found or is unavailable. Check the model name.";
  }
  if (error instanceof OpenAI.RateLimitError) {
    if (error.code === "insufficient_quota") {
      return "OpenAI quota exhausted (insufficient_quota). Check billing/usage limits in your OpenAI account — retrying will not help.";
    }
    return `OpenAI rate limit exceeded after repeated retries: ${error.message}`;
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
      const response = await withRateLimitRetry(() =>
        this.client.responses.create({
          model: input.model,
          instructions: input.systemPrompt,
          input: input.userPrompt,
          temperature: input.temperature,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          store: false,
        }),
      );

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
