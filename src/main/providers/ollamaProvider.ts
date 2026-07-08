import type { LLMInput, LLMOutput, LLMProvider } from "./base";

export interface OllamaProviderOptions {
  baseUrl: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function unreachableMessage(baseUrl: string): string {
  return `Could not reach Ollama at ${baseUrl}. Is it running? Try: ollama serve`;
}

export class OllamaProvider implements LLMProvider {
  constructor(private options: OllamaProviderOptions) {}

  async generateMarkdown(input: LLMInput): Promise<LLMOutput> {
    const baseUrl = normalizeBaseUrl(this.options.baseUrl);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          stream: false,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
          ...(input.temperature !== undefined
            ? { options: { temperature: input.temperature } }
            : {}),
        }),
      });
    } catch {
      throw new Error(unreachableMessage(baseUrl));
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (response.status === 404) {
        throw new Error(
          `Ollama model "${input.model}" was not found. Try: ollama pull ${input.model}`,
        );
      }
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const text = data.message?.content;
    if (!text) {
      throw new Error("Ollama returned an empty response.");
    }

    return { text, raw: data };
  }
}

export interface OllamaConnectionTestResult {
  ok: boolean;
  message: string;
  models?: string[];
}

export async function testOllamaConnection(baseUrl: string): Promise<OllamaConnectionTestResult> {
  const normalized = normalizeBaseUrl(baseUrl);
  try {
    const response = await fetch(`${normalized}/api/tags`);
    if (!response.ok) {
      return { ok: false, message: `Ollama responded with status ${response.status}.` };
    }
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    return {
      ok: true,
      message: models.length > 0 ? `Connected. ${models.length} model(s) available.` : "Connected. No models pulled yet.",
      models,
    };
  } catch {
    return { ok: false, message: unreachableMessage(normalized) };
  }
}
