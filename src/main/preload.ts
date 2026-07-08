import { contextBridge, ipcRenderer } from "electron";
import type { PaperDistillAPI, PdfJob } from "../shared/types";

const api: PaperDistillAPI = {
  selectPdfFolder: () => ipcRenderer.invoke("fs:selectPdfFolder"),
  selectPromptFile: () => ipcRenderer.invoke("fs:selectPromptFile"),
  selectOutputFolder: () => ipcRenderer.invoke("fs:selectOutputFolder"),
  scanPdfFolder: (options) => ipcRenderer.invoke("pdf:scan", options),
  onScanStarted: (callback: (jobs: PdfJob[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, jobs: PdfJob[]) => callback(jobs);
    ipcRenderer.on("pdf:scanStarted", listener);
    return () => ipcRenderer.removeListener("pdf:scanStarted", listener);
  },
  onScanProgress: (callback: (job: PdfJob) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, job: PdfJob) => callback(job);
    ipcRenderer.on("pdf:scanProgress", listener);
    return () => ipcRenderer.removeListener("pdf:scanProgress", listener);
  },
  startBatch: (options) => ipcRenderer.invoke("batch:start", options),
  onBatchProgress: (callback: (job: PdfJob) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, job: PdfJob) => callback(job);
    ipcRenderer.on("batch:progress", listener);
    return () => ipcRenderer.removeListener("batch:progress", listener);
  },
  getEnvKeyStatus: () => ipcRenderer.invoke("env:getKeyStatus"),
  testOllamaConnection: (baseUrl) => ipcRenderer.invoke("ollama:testConnection", baseUrl),
  pauseBatch: () => ipcRenderer.invoke("batch:pause"),
  resumeBatch: () => ipcRenderer.invoke("batch:resume"),
  cancelBatch: () => ipcRenderer.invoke("batch:cancel"),
  openOutputFolder: (outputFolder) => ipcRenderer.invoke("fs:openOutputFolder", outputFolder),
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
};

contextBridge.exposeInMainWorld("api", api);
