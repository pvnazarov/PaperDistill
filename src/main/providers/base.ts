import type { LLMProviderName } from "../../shared/types";

export type { LLMProviderName };

export interface LLMInput {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature?: number;
}

export interface LLMOutput {
  text: string;
  raw?: unknown;
}

export interface LLMProvider {
  generateMarkdown(input: LLMInput): Promise<LLMOutput>;
}

export const DEFAULT_SYSTEM_PROMPT =
  'You are a precise scientific paper extraction assistant. Follow the user-provided extraction prompt exactly. Work only from the provided PDF text unless the prompt explicitly permits external retrieval. Do not invent information. If information is missing, write "Not found in PDF". Preserve scientific precision and generate valid Markdown.';
