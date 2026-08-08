# PaperDistill

PaperDistill is a local desktop application for batch-converting scientific PDF papers into structured, AI-ready Markdown files.

It takes a folder of PDFs, a user-supplied prompt file describing the extraction schema you want, and an LLM backend (Anthropic, OpenAI, or a local Ollama model), and produces one Markdown file per PDF — suitable for building a long-term knowledge base of bioinformatics, computational biology, statistics, AI, omics, cancer research, or translational biomedicine papers.

PaperDistill itself never invents or alters scientific content: extraction is driven entirely by your prompt, the text extracted from the PDF, and the LLM you choose. The default system instruction tells the model to work only from the provided text, write `Not found in PDF` for missing information, and avoid hallucinating metadata, methods, or results.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts the Vite dev server for the renderer, compiles the Electron main process in watch mode, and launches the Electron window once both are ready. Dev tools open automatically.

## Build / Package

```bash
npm run build      # compiles the renderer (Vite) and the main process (tsc)
npm run package    # additionally bundles the app with electron-builder into release/
```

## Testing

```bash
npm test
```

Runs the vitest suite: PDF discovery, prompt placeholder substitution, scanned-PDF detection, chunking, provider abstraction (including a mocked OpenAI SDK and a deterministic mock provider), and the batch runner's output-filename generation, skip/resume/overwrite logic, atomic writes, and per-PDF failure isolation.

## Usage

1. Select a **PDF folder**, a **prompt TXT file**, and an **output folder**.
2. Choose an **LLM provider** and enter a **model name**.
3. Click **Scan PDFs** to discover and extract text from every PDF (this also flags likely-scanned/image-only PDFs, which are skipped rather than sent to the LLM).
4. Click **Start** to generate one Markdown file per PDF. Use **Pause**/**Resume**/**Cancel** to control a running batch, and **Open Output Folder** to jump to the results.

### Bundled prompts

Two ready-made prompts ship with the app, selectable from the buttons next to **Prompt TXT File**:

- **Use Papers Prompt** — `default_prompt.txt`, for extracting published research papers.
- **Use Proposals Prompt** — `prompt_proposals.txt`, for research/grant proposals: it captures work packages, deliverables, planned datasets and cohorts, partners and infrastructure, and which methods were proposed for which data.

Both are plain text — copy one and edit it to build your own schema, then load it with **Choose File…**.

### Prompt file placeholders

Your prompt TXT file can use these placeholders, which are substituted before the PDF text is sent to the LLM:

```text
{{PDF_TEXT}}
{{PDF_FILENAME}}
{{PDF_PATH}}
{{PAGE_COUNT}}
```

If `{{PDF_TEXT}}` is present, it's replaced with the extracted text. If it's absent, the extracted text is appended after your prompt under a delimited `EXTRACTED PDF TEXT:` section instead — so a plain-English prompt with no placeholders still works.

### Using Anthropic

```bash
ANTHROPIC_API_KEY=your_key_here
npm run dev
```

Select provider **Anthropic**, enter or confirm the model name (e.g. `claude-sonnet-4-5`), select your PDF folder, prompt TXT, and output folder, then click Start. If `ANTHROPIC_API_KEY` isn't set in `.env`, you can paste a key into the app for the current session instead.

### Using OpenAI

```bash
OPENAI_API_KEY=your_key_here
npm run dev
```

Select provider **OpenAI**, enter or confirm the model name (e.g. `gpt-4o`), select your PDF folder, prompt TXT, and output folder, then click Start. As with Anthropic, a session-only API key can be pasted into the app if `OPENAI_API_KEY` isn't in `.env`.

### Using Ollama

```bash
ollama serve
ollama pull <MODEL_NAME>
npm run dev
```

Select provider **Ollama**, enter the model name and confirm the Ollama URL (default `http://localhost:11434`), use **Test Connection** to verify it's reachable, then select your PDF folder, prompt TXT, and output folder, and click Start. No API key is required.

## Input / Output Structure

**Input:**
- A folder of `.pdf`/`.PDF` files (recursive scanning is optional, off by default).
- A prompt `.txt` file describing the desired Markdown structure.
- An output folder (created if it doesn't exist).

**Output**, per PDF, in the output folder:
- `<pdf_stem>.md` — the generated Markdown (written atomically: a temp file is written and renamed into place, so a crash or cancel never leaves a half-written file).
- `<pdf_stem>.paperdistill.json` — a sidecar with `pdf_path`, `output_md`, `provider`, `model`, `page_count`, `status`, `error`.
- `<pdf_stem>.failed.txt` — only if **Write failure files** is enabled and the PDF failed.
- `paperdistill_run_log.jsonl` — one JSON line appended per processed PDF for the whole run.

By default, existing `.md` files are never overwritten. Enable **Overwrite existing files** to force reprocessing, or **Resume / skip completed files** to explicitly skip PDFs that already have output (this takes priority over overwrite).

### Long PDFs

If a PDF's text is short enough to fit under **Max input chars** (default 180,000) alongside your prompt, it's processed in a single LLM call. Longer PDFs are automatically split into overlapping chunks (**Chunk size chars** / **Chunk overlap chars**, default 70,000 / 5,000): each chunk is sent to the LLM to extract factual notes only, and a final call synthesizes those notes into the Markdown your prompt asks for.

### Scanned / image-only PDFs

A PDF is flagged as likely scanned if it has fewer than 500 extracted characters total, or fewer than 100 characters per page on average. These are marked with a `warning` status and skipped — OCR is not implemented in this version.

## Limitations

- **PDF text extraction** uses `pdfjs-dist`, which is generally reliable but can struggle with complex scientific PDF layouts (multi-column text, embedded figures/tables, unusual fonts) more than a native tool like PyMuPDF would. A natural future upgrade is an optional Python extraction worker alongside this Electron UI.
- **No OCR.** Scanned/image-only PDFs are detected and skipped, not processed.
- **Session-only API keys.** Keys pasted into the app are held in memory for the current session only and are never written to disk; only non-sensitive settings (provider, model, URLs, toggles, chunking sizes) are persisted between runs.
- **Single batch at a time.** There's one job queue; starting a new batch while one is running isn't supported from the UI.
- **No cross-run resume tracking beyond the filesystem.** "Resume" works by checking whether `<stem>.md` already exists in the output folder — it doesn't track partial chunk progress within a single PDF.
- **Cloud-synced project folders (Dropbox, OneDrive, etc.) can cause file-locking errors.** Both `npm run dev` (Vite's dependency cache) and `npm run package` (electron-builder unpacking the Electron binary) can intermittently fail with `EBUSY`/`EPERM` errors if the project lives inside a folder being actively synced — the sync client briefly locks freshly-written files/directories. Retrying usually succeeds; for reliable packaging, build from a non-synced path or exclude `node_modules`/`release` from sync.

## Project Structure

```text
PaperDistill/
  package.json
  .env.example
  src/
    main/
      main.ts              # Electron entry point, window + dotenv loading
      preload.ts            # contextBridge-exposed IPC surface
      ipc.ts                 # IPC handler registration
      fileSystem.ts          # Native dialogs, PDF discovery
      pdfExtract.ts           # pdfjs-dist text extraction, scanned-PDF detection
      promptBuilder.ts        # Placeholder substitution
      chunker.ts               # Overlapping-chunk splitting for long PDFs
      batchRunner.ts           # Orchestrates scan -> prompt -> LLM -> write -> log
      configStore.ts           # Non-sensitive settings persistence
      providers/
        base.ts                # LLMProvider interface, shared system prompt
        index.ts                # Provider factory (resolves API keys, picks implementation)
        anthropicProvider.ts
        openaiProvider.ts
        ollamaProvider.ts
        mockProvider.ts         # Deterministic provider used in tests
    renderer/
      main.tsx
      App.tsx
      components/
        FolderPicker.tsx
        PromptFilePicker.tsx
        OutputFolderPicker.tsx
        ProviderSettings.tsx
        JobTable.tsx
        LogPanel.tsx
      styles/app.css
    shared/
      types.ts               # IPC contract shared between main and renderer
```
