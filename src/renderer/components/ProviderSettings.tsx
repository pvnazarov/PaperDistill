import { useState } from "react";
import type { EnvKeyStatus, LLMProviderName } from "../../shared/types";

interface ProviderSettingsProps {
  providerName: LLMProviderName;
  onProviderNameChange: (name: LLMProviderName) => void;
  model: string;
  onModelChange: (model: string) => void;
  anthropicApiKey: string;
  onAnthropicApiKeyChange: (key: string) => void;
  openaiApiKey: string;
  onOpenaiApiKeyChange: (key: string) => void;
  ollamaUrl: string;
  onOllamaUrlChange: (url: string) => void;
  envKeyStatus: EnvKeyStatus | null;
}

function ProviderSettings({
  providerName,
  onProviderNameChange,
  model,
  onModelChange,
  anthropicApiKey,
  onAnthropicApiKeyChange,
  openaiApiKey,
  onOpenaiApiKeyChange,
  ollamaUrl,
  onOllamaUrlChange,
  envKeyStatus,
}: ProviderSettingsProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleTestOllamaConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.api.testOllamaConnection(ollamaUrl);
      setTestResult(result.message);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="provider-settings">
      <h2>LLM Provider</h2>

      <div className="field-row">
        <label className="field-label">Provider</label>
        <div className="field-control">
          <select
            value={providerName}
            onChange={(e) => onProviderNameChange(e.target.value as LLMProviderName)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
          </select>
          <span className="field-value">
            PDFs will be processed with{" "}
            {providerName === "anthropic" ? "Anthropic" : providerName === "openai" ? "OpenAI" : "Ollama"}.
          </span>
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Model Name</label>
        <div className="field-control">
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder={
              providerName === "anthropic"
                ? "e.g. claude-sonnet-4-5"
                : providerName === "openai"
                  ? "e.g. gpt-4o"
                  : "e.g. llama3.1"
            }
          />
        </div>
      </div>

      {providerName === "anthropic" && (
        <div className="field-row">
          <label className="field-label">Anthropic API Key</label>
          <div className="field-control">
            <input
              type="password"
              value={anthropicApiKey}
              onChange={(e) => onAnthropicApiKeyChange(e.target.value)}
              placeholder={
                envKeyStatus?.anthropicKeyPresent
                  ? "Loaded from ANTHROPIC_API_KEY (.env)"
                  : "Paste API key for this session"
              }
            />
            <span className="field-value">
              {envKeyStatus?.anthropicKeyPresent
                ? "ANTHROPIC_API_KEY found in .env (used unless overridden above)"
                : "No ANTHROPIC_API_KEY found in .env"}
            </span>
          </div>
        </div>
      )}

      {providerName === "openai" && (
        <div className="field-row">
          <label className="field-label">OpenAI API Key</label>
          <div className="field-control">
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
              placeholder={
                envKeyStatus?.openaiKeyPresent
                  ? "Loaded from OPENAI_API_KEY (.env)"
                  : "Paste API key for this session"
              }
            />
            <span className="field-value">
              {envKeyStatus?.openaiKeyPresent
                ? "OPENAI_API_KEY found in .env (used unless overridden above)"
                : "No OPENAI_API_KEY found in .env"}
            </span>
          </div>
        </div>
      )}

      {providerName === "ollama" && (
        <div className="field-row">
          <label className="field-label">Ollama URL</label>
          <div className="field-control">
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => onOllamaUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
            />
            <button type="button" onClick={handleTestOllamaConnection} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </button>
            {testResult && <span className="field-value">{testResult}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export default ProviderSettings;
