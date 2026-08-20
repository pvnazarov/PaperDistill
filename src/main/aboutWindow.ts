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

import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { APP_VERSION, BUILD_DATE } from "./buildInfo";

let aboutWindow: BrowserWindow | null = null;

export async function showAboutWindow(parent: BrowserWindow): Promise<void> {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  const iconPath = path.join(app.getAppPath(), "build/icon.png");
  const iconBase64 = await fs.readFile(iconPath, "base64");

  aboutWindow = new BrowserWindow({
    width: 420,
    height: 480,
    parent,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "About PaperDistill",
    autoHideMenuBar: true,
    webPreferences: { sandbox: true },
  });
  aboutWindow.setMenu(null);

  const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>About PaperDistill</title>
<style>
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #1e1f22;
    color: #e6e6e6;
    text-align: center;
    padding: 32px 28px;
  }
  img { width: 96px; height: 96px; border-radius: 20px; margin-bottom: 16px; }
  h1 { margin: 0 0 4px 0; font-size: 20px; }
  .summary { color: #c7c9cc; font-size: 13px; margin: 0 0 20px 0; line-height: 1.5; }
  .meta { font-size: 12px; color: #a0a3a8; }
  .copyright {
    border-top: 1px solid #33353a;
    margin-top: 20px;
    padding-top: 16px;
    font-size: 11px;
    color: #7d7f85;
    line-height: 1.7;
  }
</style>
</head>
<body>
  <img src="data:image/png;base64,${iconBase64}" alt="PaperDistill" />
  <h1>PaperDistill</h1>
  <p class="summary">
    Batch-converts scientific documents into structured, AI-ready Markdown using
    local or cloud LLMs (Anthropic, OpenAI, or Ollama).
  </p>
  <p class="meta">Version ${APP_VERSION} &middot; Built ${BUILD_DATE}</p>
  <div class="copyright">
    PaperDistill<br />
    Copyright (c) 2026 Petr Nazarov, Luxembourg Institute of Health (LIH)<br /><br />
    Released under the MIT License.<br />
    Developed with significant assistance from Anthropic Claude Code.<br />
    Responsibility for any bugs remains under active investigation.
  </div>
</body>
</html>`;

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}
