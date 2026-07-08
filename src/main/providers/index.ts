import type { ProviderConfig } from "../../shared/types";
import type { LLMProvider } from "./base";
import { AnthropicProvider } from "./anthropicProvider";
import { OpenAIProvider } from "./openaiProvider";
import { OllamaProvider } from "./ollamaProvider";

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.providerName) {
    case "anthropic": {
      const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing Anthropic API key. Set ANTHROPIC_API_KEY in .env or enter it in the app.",
        );
      }
      return new AnthropicProvider({ apiKey });
    }
    case "openai": {
      const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing OpenAI API key. Set OPENAI_API_KEY in .env or enter it in the app.",
        );
      }
      return new OpenAIProvider({ apiKey });
    }
    case "ollama": {
      const baseUrl = config.ollamaUrl || "http://localhost:11434";
      return new OllamaProvider({ baseUrl });
    }
    default: {
      const exhaustiveCheck: never = config.providerName;
      throw new Error(`Unknown provider: ${exhaustiveCheck}`);
    }
  }
}

export { testOllamaConnection } from "./ollamaProvider";
