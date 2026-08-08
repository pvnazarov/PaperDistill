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

import { useEffect, useRef, useState } from "react";
import type {
  AppConfig,
  BundledPromptId,
  EnvKeyStatus,
  LLMProviderName,
  PdfJob,
} from "../shared/types";
import appIcon from "./assets/app-icon.png";
import lihLogo from "./assets/lih-logo.png";
import FolderPicker from "./components/FolderPicker";
import PromptFilePicker from "./components/PromptFilePicker";
import OutputFolderPicker from "./components/OutputFolderPicker";
import ProviderSettings from "./components/ProviderSettings";
import JobTable from "./components/JobTable";
import LogPanel from "./components/LogPanel";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MAX_INPUT_CHARS = 180000;
const DEFAULT_CHUNK_SIZE_CHARS = 70000;
const DEFAULT_CHUNK_OVERLAP_CHARS = 5000;
const CONFIG_SAVE_DEBOUNCE_MS = 500;

// Credit line, split so the footer can turn the organisation into a link.
// Kept in step with the same line in VennKit.
const ORG_NAME = "Luxembourg Institute of Health";
const ORG_URL = "https://www.lih.lu/en/";
const CREDIT_PREFIX = `PaperDistill v${__APP_VERSION__} — © 2026 P.Nazarov, `;
const CREDIT_SUFFIX = " · MIT License";
const BUILT_WITH_TEXT = "Built with Claude Code";
const BUILT_WITH_URL = "https://claude.com/claude-code";

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function formatElapsed(startedAtMs: number): string {
  return `${((Date.now() - startedAtMs) / 1000).toFixed(1)}s`;
}

function App() {
  const [pdfFolder, setPdfFolder] = useState<string | null>(null);
  const [promptFile, setPromptFile] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [recursive, setRecursive] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [resumeMode, setResumeMode] = useState(false);
  const [writeFailureFiles, setWriteFailureFiles] = useState(false);
  const [addYamlHeader, setAddYamlHeader] = useState(false);
  const [maxInputChars, setMaxInputChars] = useState(DEFAULT_MAX_INPUT_CHARS);
  const [chunkSizeChars, setChunkSizeChars] = useState(DEFAULT_CHUNK_SIZE_CHARS);
  const [chunkOverlapChars, setChunkOverlapChars] = useState(DEFAULT_CHUNK_OVERLAP_CHARS);
  const [jobs, setJobs] = useState<PdfJob[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [providerName, setProviderName] = useState<LLMProviderName>("anthropic");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_URL);
  const [envKeyStatus, setEnvKeyStatus] = useState<EnvKeyStatus | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const jobStartTimesRef = useRef<Map<string, number>>(new Map());

  const model = providerName === "anthropic" ? anthropicModel : providerName === "openai" ? openaiModel : ollamaModel;

  function setModel(value: string) {
    if (providerName === "anthropic") setAnthropicModel(value);
    else if (providerName === "openai") setOpenaiModel(value);
    else setOllamaModel(value);
  }

  function appendLog(message: string) {
    setLogs((prev) => [...prev, `[${timestamp()}] ${message}`]);
  }

  useEffect(() => {
    window.api.getEnvKeyStatus().then(setEnvKeyStatus);
  }, []);

  useEffect(() => {
    window.api.loadConfig().then((config) => {
      if (config.providerName) setProviderName(config.providerName);
      if (config.anthropicModel) setAnthropicModel(config.anthropicModel);
      if (config.openaiModel) setOpenaiModel(config.openaiModel);
      if (config.ollamaModel) setOllamaModel(config.ollamaModel);
      if (config.ollamaUrl) setOllamaUrl(config.ollamaUrl);
      if (config.recursive !== undefined) setRecursive(config.recursive);
      if (config.overwrite !== undefined) setOverwrite(config.overwrite);
      if (config.resumeMode !== undefined) setResumeMode(config.resumeMode);
      if (config.writeFailureFiles !== undefined) setWriteFailureFiles(config.writeFailureFiles);
      if (config.addYamlHeader !== undefined) setAddYamlHeader(config.addYamlHeader);
      if (config.maxInputChars !== undefined) setMaxInputChars(config.maxInputChars);
      if (config.chunkSizeChars !== undefined) setChunkSizeChars(config.chunkSizeChars);
      if (config.chunkOverlapChars !== undefined) setChunkOverlapChars(config.chunkOverlapChars);
      setConfigLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    const config: AppConfig = {
      providerName,
      anthropicModel,
      openaiModel,
      ollamaModel,
      ollamaUrl,
      recursive,
      overwrite,
      resumeMode,
      writeFailureFiles,
      addYamlHeader,
      maxInputChars,
      chunkSizeChars,
      chunkOverlapChars,
    };
    const timer = setTimeout(() => {
      window.api.saveConfig(config);
    }, CONFIG_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    configLoaded,
    providerName,
    anthropicModel,
    openaiModel,
    ollamaModel,
    ollamaUrl,
    recursive,
    overwrite,
    resumeMode,
    writeFailureFiles,
    addYamlHeader,
    maxInputChars,
    chunkSizeChars,
    chunkOverlapChars,
  ]);

  useEffect(() => {
    const unsubscribeStarted = window.api.onScanStarted((initialJobs) => {
      setJobs(initialJobs);
    });
    const unsubscribeScanProgress = window.api.onScanProgress((updatedJob) => {
      setJobs((prev) =>
        prev.map((job) => (job.filePath === updatedJob.filePath ? updatedJob : job)),
      );
    });
    const unsubscribeBatchProgress = window.api.onBatchProgress((updatedJob) => {
      setJobs((prev) =>
        prev.map((job) => (job.filePath === updatedJob.filePath ? updatedJob : job)),
      );
      if (updatedJob.status === "processing") {
        if (!jobStartTimesRef.current.has(updatedJob.filePath)) {
          jobStartTimesRef.current.set(updatedJob.filePath, Date.now());
          appendLog(`Processing ${updatedJob.fileName}`);
        }
      } else {
        const startedAt = jobStartTimesRef.current.get(updatedJob.filePath);
        jobStartTimesRef.current.delete(updatedJob.filePath);
        const elapsed = startedAt !== undefined ? ` (${formatElapsed(startedAt)})` : "";
        if (updatedJob.status === "success") {
          appendLog(
            `Success: ${updatedJob.outputPath ? basename(updatedJob.outputPath) : updatedJob.fileName}${elapsed}`,
          );
        } else if (updatedJob.status === "warning") {
          appendLog(`Warning: ${updatedJob.fileName} — ${updatedJob.errorMessage ?? ""}${elapsed}`);
        } else if (updatedJob.status === "failed") {
          appendLog(`Failed: ${updatedJob.fileName} — ${updatedJob.errorMessage ?? ""}${elapsed}`);
        } else if (updatedJob.status === "skipped") {
          appendLog(`Skipped: ${updatedJob.fileName} — ${updatedJob.errorMessage ?? ""}${elapsed}`);
        }
      }
    });
    return () => {
      unsubscribeStarted();
      unsubscribeScanProgress();
      unsubscribeBatchProgress();
    };
  }, []);

  async function handleSelectPdfFolder() {
    const folder = await window.api.selectPdfFolder();
    if (folder) setPdfFolder(folder);
  }

  async function handleSelectPromptFile() {
    const file = await window.api.selectPromptFile();
    if (file) setPromptFile(file);
  }

  async function handleUseBundledPrompt(id: BundledPromptId) {
    const file = await window.api.getBundledPromptPath(id);
    setPromptFile(file);
  }

  async function handleSelectOutputFolder() {
    const folder = await window.api.selectOutputFolder();
    if (folder) setOutputFolder(folder);
  }

  async function handleScanPdfs() {
    if (!pdfFolder) return;
    setScanning(true);
    setScanError(null);
    const startedAt = Date.now();
    try {
      const result = await window.api.scanPdfFolder({ folderPath: pdfFolder, recursive });
      setJobs(result);
      appendLog(`Scanned ${result.length} PDFs. (${formatElapsed(startedAt)})`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setScanning(false);
    }
  }

  async function handleStartBatch() {
    if (!promptFile || !outputFolder || jobs.length === 0 || !model) return;
    setRunning(true);
    setPaused(false);
    setRunError(null);
    const startedAt = Date.now();
    appendLog(`Starting batch: ${jobs.length} PDFs.`);
    try {
      const result = await window.api.startBatch({
        filePaths: jobs.map((job) => job.filePath),
        promptFilePath: promptFile,
        outputFolder,
        providerConfig: {
          providerName,
          model,
          apiKey: providerName === "anthropic" ? anthropicApiKey : openaiApiKey,
          ollamaUrl,
        },
        overwrite,
        resumeMode,
        writeFailureFiles,
        addYamlHeader,
        maxInputChars,
        chunkSizeChars,
        chunkOverlapChars,
      });
      setJobs(result);
      appendLog(`Batch complete. (${formatElapsed(startedAt)})`);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
      setPaused(false);
    }
  }

  async function handleTogglePause() {
    if (paused) {
      await window.api.resumeBatch();
      appendLog("Resumed.");
      setPaused(false);
    } else {
      await window.api.pauseBatch();
      appendLog("Paused after the current PDF finishes.");
      setPaused(true);
    }
  }

  async function handleCancel() {
    await window.api.cancelBatch();
    appendLog("Cancel requested; stopping after the current PDF.");
  }

  async function handleOpenOutputFolder() {
    if (!outputFolder) return;
    await window.api.openOutputFolder(outputFolder);
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src={appIcon} alt="PaperDistill" className="app-header-icon" />
        <div className="app-header-text">
          <h1>PaperDistill</h1>
          <p className="app-subtitle">
            Batch-convert scientific PDF papers into structured, AI-ready Markdown.
          </p>
        </div>
        <img src={lihLogo} alt="Luxembourg Institute of Health" className="app-header-lih-logo" />
      </header>
      <main className="app-main">
        <FolderPicker value={pdfFolder} onSelect={handleSelectPdfFolder} />
        <PromptFilePicker
          value={promptFile}
          onSelect={handleSelectPromptFile}
          onUseBundled={handleUseBundledPrompt}
        />
        <OutputFolderPicker value={outputFolder} onSelect={handleSelectOutputFolder} />

        <ProviderSettings
          providerName={providerName}
          onProviderNameChange={setProviderName}
          model={model}
          onModelChange={setModel}
          anthropicApiKey={anthropicApiKey}
          onAnthropicApiKeyChange={setAnthropicApiKey}
          openaiApiKey={openaiApiKey}
          onOpenaiApiKeyChange={setOpenaiApiKey}
          ollamaUrl={ollamaUrl}
          onOllamaUrlChange={setOllamaUrl}
          envKeyStatus={envKeyStatus}
        />

        <div className="field-row field-row-inline options-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />
            Recursive PDF search
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Overwrite existing files
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={resumeMode}
              onChange={(e) => setResumeMode(e.target.checked)}
            />
            Resume / skip completed files
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={writeFailureFiles}
              onChange={(e) => setWriteFailureFiles(e.target.checked)}
            />
            Write failure files
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={addYamlHeader}
              onChange={(e) => setAddYamlHeader(e.target.checked)}
            />
            Add YAML header
          </label>
        </div>

        <div className="field-row field-row-inline options-row">
          <label className="number-field-label">
            Max input chars
            <input
              type="number"
              value={maxInputChars}
              min={1000}
              step={1000}
              onChange={(e) => setMaxInputChars(Number(e.target.value))}
            />
          </label>
          <label className="number-field-label">
            Chunk size chars
            <input
              type="number"
              value={chunkSizeChars}
              min={1000}
              step={1000}
              onChange={(e) => setChunkSizeChars(Number(e.target.value))}
            />
          </label>
          <label className="number-field-label">
            Chunk overlap chars
            <input
              type="number"
              value={chunkOverlapChars}
              min={0}
              step={500}
              onChange={(e) => setChunkOverlapChars(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="field-row">
          <div className="field-control">
            <button type="button" onClick={handleScanPdfs} disabled={!pdfFolder || scanning || running}>
              {scanning ? "Scanning…" : "Scan PDFs"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={handleStartBatch}
              disabled={
                !promptFile || !outputFolder || !model || jobs.length === 0 || running || scanning
              }
            >
              {running ? "Running…" : "Start"}
            </button>
            <button type="button" onClick={handleTogglePause} disabled={!running}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={handleCancel} disabled={!running}>
              Cancel
            </button>
            <button type="button" onClick={handleOpenOutputFolder} disabled={!outputFolder}>
              Open Output Folder
            </button>
            {scanError && <span className="scan-error">{scanError}</span>}
            {runError && <span className="scan-error">{runError}</span>}
          </div>
        </div>

        <section className="job-section">
          <h2>Jobs</h2>
          <JobTable jobs={jobs} />
        </section>

        <LogPanel lines={logs} />
      </main>
      <footer className="app-footer">
        {CREDIT_PREFIX}
        <a href={ORG_URL} target="_blank" rel="noopener noreferrer">
          {ORG_NAME}
        </a>
        {CREDIT_SUFFIX}
        <span className="footer-sep"> · </span>
        <a href={BUILT_WITH_URL} target="_blank" rel="noopener noreferrer">
          {BUILT_WITH_TEXT}
        </a>
      </footer>
    </div>
  );
}

export default App;
