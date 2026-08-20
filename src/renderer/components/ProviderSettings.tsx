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

import { useEffect, useState } from "react";
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

const PROVIDER_LABELS: Record<LLMProviderName, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama",
};

const LOCAL_OLLAMA_URL = "http://localhost:11434";
const MODEL_FETCH_DEBOUNCE_MS = 500;

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
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    setTestResult(null);
  }, [providerName]);

  useEffect(() => {
    if (providerName !== "ollama") return;
    const timer = setTimeout(() => {
      window.api
        .testOllamaConnection(ollamaUrl)
        .then((result) => setOllamaModels(result.ok && result.models ? result.models : []))
        .catch(() => setOllamaModels([]));
    }, MODEL_FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [providerName, ollamaUrl]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      if (providerName === "ollama") {
        const result = await window.api.testOllamaConnection(ollamaUrl);
        setTestResult(result.message);
        setOllamaModels(result.ok && result.models ? result.models : []);
      } else if (providerName === "anthropic") {
        const result = await window.api.testAnthropicConnection(anthropicApiKey, model);
        setTestResult(result.message);
      } else {
        const result = await window.api.testOpenAIConnection(openaiApiKey, model);
        setTestResult(result.message);
      }
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  const availableModels = providerName === "ollama" ? ollamaModels : [];

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
          {providerName === "ollama" && (
            <button type="button" onClick={() => onOllamaUrlChange(LOCAL_OLLAMA_URL)}>
              Local
            </button>
          )}
          <span className="field-value">
            Files will be processed with {PROVIDER_LABELS[providerName]}.
          </span>
        </div>
      </div>

      <div className="field-row">
        <label className="field-label">Model Name</label>
        <div className="field-control">
          {availableModels.length > 0 ? (
            <>
              <select value={model} onChange={(e) => onModelChange(e.target.value)}>
                <option value="">Select a model…</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="field-value">{availableModels.length} model(s) available</span>
            </>
          ) : (
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
          )}
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
            <button type="button" onClick={handleTestConnection} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </button>
            {testResult && <span className="field-value">{testResult}</span>}
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
            <button type="button" onClick={handleTestConnection} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </button>
            {testResult && <span className="field-value">{testResult}</span>}
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
            <button type="button" onClick={handleTestConnection} disabled={testing}>
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
