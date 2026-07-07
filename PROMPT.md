Build a JavaScript/TypeScript-based visual desktop tool named **PaperDistill**.

## Goal

PaperDistill is a local desktop application for batch-converting scientific PDF papers into structured, AI-ready Markdown files.

The app takes:

1. A folder containing PDF files.
2. A user-supplied prompt TXT file describing the desired extraction schema.
3. An output folder.
4. An LLM backend:
   - local Ollama,
   - OpenAI API, or
   - Anthropic Claude API.

For each PDF, PaperDistill generates exactly one Markdown `.md` file using the instructions in the prompt TXT.

The primary use case is structured extraction of scientific papers in bioinformatics, computational biology, statistics, artificial intelligence, omics, cancer research, and translational biomedicine into Markdown files suitable for a long-term knowledge base.

## Application Name

Use the project name:

```text
PaperDistill
```

Use this name in:

* package metadata;
* application title;
* README;
* UI header;
* logs where appropriate.

## Preferred Architecture

Build PaperDistill as an **Electron desktop application** using:

* Electron
* React
* TypeScript
* Vite
* Node.js backend process
* local filesystem access through Electron main process

Suggested structure:

```text
PaperDistill/
  package.json
  README.md
  .env.example
  src/
    main/
      main.ts
      ipc.ts
      fileSystem.ts
      pdfExtract.ts
      promptBuilder.ts
      batchRunner.ts
      providers/
        base.ts
        anthropicProvider.ts
        openaiProvider.ts
        ollamaProvider.ts
      logging.ts
    renderer/
      App.tsx
      components/
        FolderPicker.tsx
        PromptFilePicker.tsx
        OutputFolderPicker.tsx
        ProviderSettings.tsx
        JobTable.tsx
        LogPanel.tsx
        RunControls.tsx
      styles/
        app.css
    shared/
      types.ts
```

The renderer should never directly access the filesystem. Use secure Electron IPC calls to communicate with the main process.

## UI Requirements

The app should provide a simple visual workflow.

### Main screen

Include:

1. App title: **PaperDistill**
2. PDF folder selector
3. Prompt TXT file selector
4. Output folder selector
5. Provider selector:
   - Anthropic
   - OpenAI
   - Ollama
6. Model name input
7. Anthropic API key field or indication that `ANTHROPIC_API_KEY` is loaded from `.env`
8. OpenAI API key field or indication that `OPENAI_API_KEY` is loaded from `.env`
9. Ollama URL field, default:

```text
http://localhost:11434
```

10. Options:

   * recursive PDF search
   * overwrite existing Markdown files
   * resume / skip completed files
   * add YAML header
   * write failure files
   * max input characters
   * chunk size characters
   * chunk overlap characters

11. Buttons:

* Scan PDFs
* Start
* Pause
* Cancel
* Open Output Folder

### Job table

Show one row per PDF with:

* PDF filename
* page count
* extracted character count
* status:

  * pending
  * processing
  * success
  * skipped
  * warning
  * failed
* processing mode:

  * single call
  * chunked
* output Markdown path
* error message, if any

### Log panel

Show concise timestamped logs.

Example:

```text
[14:03:12] Scanned 25 PDFs.
[14:03:15] Processing Despotovic(2024)Heliyon.pdf
[14:04:02] Success: Despotovic(2024)Heliyon.md
```

## Provider-Specific UI Behavior

When the user selects Anthropic:

- show Anthropic API key status;
- show or enable Anthropic API key session input;
- use `ANTHROPIC_API_KEY` if available.

When the user selects OpenAI:

- show OpenAI API key status;
- show or enable OpenAI API key session input;
- use `OPENAI_API_KEY` if available.

When the user selects Ollama:

- show Ollama URL;
- do not ask for an API key by default;
- provide a simple connection test if feasible.

The UI should make clear which backend will process the PDFs before the user starts the batch.

## Input Behavior

### PDF folder

The app should process files ending in:

```text
.pdf
.PDF
```

Support recursive scanning if enabled.

Default: non-recursive.

### Prompt TXT file

The prompt TXT is the authoritative extraction instruction.

The app must support placeholders inside the prompt:

```text
{{PDF_TEXT}}
{{PDF_FILENAME}}
{{PDF_PATH}}
{{PAGE_COUNT}}
```

If `{{PDF_TEXT}}` is present, replace it with extracted PDF text.

If `{{PDF_TEXT}}` is absent, append the extracted text after the prompt under a clearly delimited section:

```text
---

PDF FILE:
<filename>

EXTRACTED PDF TEXT:
<page-aware extracted text>
```

## PDF Text Extraction

Implement PDF text extraction in the Electron main process.

Use a reliable JavaScript-compatible PDF text extraction library such as:

```text
pdfjs-dist
```

Extract text page by page.

Preserve page boundaries using:

```text
[PAGE 1]
...
[PAGE 2]
...
```

Basic metadata to collect:

* PDF filename
* PDF path
* page count
* extracted character count
* extraction timestamp
* extraction backend

## Scanned PDF Detection

Detect likely scanned PDFs.

A PDF should be flagged as likely scanned if:

```text
total extracted characters < 500
```

or:

```text
average extracted characters per page < 100
```

Default behavior:

* do not run OCR automatically;
* mark the PDF as warning or failed;
* log that little or no extractable text was found;
* continue with the next PDF.

Add a future-ready UI option:

```text
Enable OCR
```

but OCR implementation is optional for the first version. If OCR is not implemented, the UI should clearly say:

```text
OCR is not implemented in this version.
```

## LLM Providers

Implement a clean provider abstraction with three interchangeable providers:

- `anthropic`
- `openai`
- `ollama`

Suggested interface:

```typescript
export interface LLMProvider {
  generateMarkdown(input: LLMInput): Promise<LLMOutput>;
}
```

Where:

```typescript
export type LLMProviderName = "anthropic" | "openai" | "ollama";

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
```

### Shared system instruction

Use this system instruction by default:

```text
You are a precise scientific paper extraction assistant. Follow the user-provided extraction prompt exactly. Work only from the provided PDF text unless the prompt explicitly permits external retrieval. Do not invent information. If information is missing, write "Not found in PDF". Preserve scientific precision and generate valid Markdown.
```

## OpenAI Provider

Use the official OpenAI SDK for JavaScript/TypeScript.

Read the API key from:

```text
OPENAI_API_KEY
```

Support `.env` using `dotenv`.

Also allow the user to paste the API key into the UI for the current session only. Do not save the API key unless secure storage is explicitly implemented.

The model name must be user-configurable.

Do not hard-code one model name.

The provider should support current OpenAI chat/responses-style models through the official SDK. Implement the request in a way that is easy to update if OpenAI changes recommended endpoints.

The OpenAI provider must use the same provider abstraction as Anthropic and Ollama, returning only the generated Markdown text to the batch runner.

If the API key is missing, invalid, or the selected model is unavailable, show a clear error message in the UI and log the failure for that PDF without stopping the batch.

## Anthropic Provider

Use the official Anthropic SDK for JavaScript/TypeScript.

Read the API key from:

```text
ANTHROPIC_API_KEY
```

Support `.env` using `dotenv`.

Also allow the user to paste the API key into the UI for the current session only. Do not save the API key unless explicitly implemented securely.

The model name must be user-configurable.

Do not hard-code one model name.

## Ollama Provider

Use the local Ollama HTTP API.

Default endpoint:

```text
http://localhost:11434
```

The user must be able to edit the Ollama URL.

The model name must be user-configurable.

If Ollama is unavailable or the model is missing, show a clear error message suggesting:

```bash
ollama serve
ollama pull <MODEL_NAME>
```

## Long PDF Handling

Implement input length protection.

The UI should expose:

```text
maxInputChars
chunkSizeChars
chunkOverlapChars
```

Default values:

```text
maxInputChars: 180000
chunkSizeChars: 70000
chunkOverlapChars: 5000
```

Behavior:

1. If prompt plus extracted PDF text is below `maxInputChars`, process in one LLM call.
2. If it exceeds `maxInputChars`, use a chunked workflow.

### Chunked workflow

#### Step 1: Per-chunk extraction

For each chunk, ask the LLM to extract factual notes from that chunk only.

Use this additional instruction:

```text
This is only one chunk of a longer paper. Extract factual information only from this chunk. Do not produce the final Markdown yet. Preserve uncertainty and page references where available.
```

#### Step 2: Final synthesis

After all chunks are processed, send the collected chunk notes to the LLM together with the original prompt TXT.

Use this additional instruction:

```text
Use only the extracted chunk notes below. Do not invent missing information. If information required by the prompt is absent, write "Not found in PDF". Produce the final Markdown according to the original prompt.
```

## Output Behavior

For each PDF, create one Markdown file.

Default output filename:

```text
<original_pdf_stem>.md
```

Example:

```text
Despotovic(2024)Heliyon.pdf
```

becomes:

```text
Despotovic(2024)Heliyon.md
```

Do not overwrite existing Markdown files unless the user enables:

```text
Overwrite existing files
```

If resume mode is enabled, skip PDFs that already have corresponding `.md` files.

## Markdown Output

The Markdown file should contain only the LLM-generated Markdown unless the user enables YAML headers.

If YAML header is enabled, prepend:

```yaml
---
source_pdf: "..."
provider: "..."
model: "..."
page_count: 12
generated_at: "..."
processing_mode: "single_call"
---
```

Default: YAML header disabled.

## Logging

Create a run-level log file in the output directory:

```text
paperdistill_run_log.jsonl
```

Each processed PDF should append one JSON line:

```json
{
  "timestamp": "...",
  "pdf_path": "...",
  "output_md": "...",
  "provider": "openai",
  "model": "...",
  "status": "success",
  "error": null,
  "page_count": 12,
  "extracted_character_count": 56321,
  "processing_mode": "single_call"
}
```

Also create an optional sidecar JSON file per PDF:

```text
<original_pdf_stem>.paperdistill.json
```

containing:

```json
{
  "pdf_path": "...",
  "output_md": "...",
  "provider": "...",
  "model": "...",
  "page_count": 12,
  "status": "success",
  "error": null
}
```

## Error Handling

The batch must not stop if one PDF fails.

For each failed PDF:

* log the error;
* mark the row as failed in the UI;
* continue with the next PDF;
* do not create misleading Markdown output.

If the user enables failure files, create:

```text
<original_pdf_stem>.failed.txt
```

containing the error message.

## Pause and Cancel

Implement:

### Pause

Pausing should stop after the currently running PDF finishes. It does not need to interrupt an active LLM request.

### Cancel

Cancel should stop the queue after the currently running PDF finishes. It should not corrupt partially written outputs.

Write Markdown files atomically:

1. write to temporary file;
2. rename to final `.md` after successful completion.

## Dependencies

Use current stable packages where appropriate.

Suggested dependencies:

```text
electron
vite
react
react-dom
typescript
pdfjs-dist
@anthropic-ai/sdk
openai
axios
dotenv
fs-extra
zod
```

Suggested dev dependencies:

```text
eslint
prettier
vitest
@testing-library/react
```

## Environment Variables

Create `.env.example` with:

```text
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

The application should load `.env` during development and packaged execution where appropriate.

API keys entered through the UI should be treated as session-only secrets unless secure storage is explicitly implemented.

## Configuration

Allow saving non-sensitive settings locally, for example:

* last selected provider
* last Ollama URL
* last model name
* last OpenAI-compatible model name, if stored separately
* recursive setting
* overwrite setting
* chunking settings

Do not save API keys unless secure storage is explicitly implemented.

Use a local config file or Electron store.

## README

Create a clear `README.md` with:

1. What PaperDistill does.
2. Installation instructions.
3. Development run command.
4. Build/package command.
5. How to use with Anthropic.
6. How to use with OpenAI.
7. How to use with Ollama.
8. Expected input/output structure.
9. Limitations.

Example development setup:

```bash
npm install
npm run dev
```

Example OpenAI setup:

```bash
OPENAI_API_KEY=your_key_here
npm run dev
```

Example Ollama setup:

```bash
ollama serve
ollama pull <MODEL_NAME>
```

Example Anthropic setup:

```bash
ANTHROPIC_API_KEY=your_key_here
npm run dev
```

## Example Provider Workflows Required in README

### Anthropic

```bash
ANTHROPIC_API_KEY=your_key_here
npm run dev
```

Select provider `Anthropic`, enter or confirm the model name, select PDF folder, prompt TXT, and output folder, then start the batch.

### OpenAI

```bash
OPENAI_API_KEY=your_key_here
npm run dev
```

Select provider `OpenAI`, enter or confirm the model name, select PDF folder, prompt TXT, and output folder, then start the batch.

### Ollama

```bash
ollama serve
ollama pull <MODEL_NAME>
npm run dev
```

Select provider `Ollama`, enter the model name and Ollama URL, select PDF folder, prompt TXT, and output folder, then start the batch.

## Testing

Create tests for:

1. PDF discovery.
2. Prompt placeholder replacement.
3. Output filename generation.
4. Skip/resume behavior.
5. Scanned-PDF detection.
6. Provider abstraction using mock provider.
7. OpenAI provider handles missing API key, unavailable model, and valid mock response.
8. Failure of one PDF does not stop the queue.
9. Atomic file writing.
10. Chunking logic.

Use `vitest`.

## Scientific Extraction Constraints

PaperDistill itself must not invent or alter scientific content.

All scientific extraction must be driven by:

1. the user’s prompt TXT;
2. the extracted PDF text;
3. the selected LLM.

The LLM instructions must emphasize:

* work only from the PDF text unless explicitly instructed otherwise;
* do not hallucinate metadata, methods, results, or interpretations;
* if information is missing, write exactly: `Not found in PDF`;
* preserve scientific precision;
* follow the structure requested in the prompt TXT;
* generate valid Markdown.

## Deliverables

Implement the complete PaperDistill project.

At the end, show:

1. final directory structure;
2. installation command;
3. development run command;
4. build/package command;
5. example workflow for Anthropic;
6. example workflow for OpenAI;
7. example workflow for Ollama;
8. known limitations or assumptions.

The final result should be a working visual desktop app that allows a user to select a folder of PDFs, select a prompt TXT file, choose an LLM backend — Anthropic, OpenAI, or Ollama — and generate one Markdown file per PDF.

One technical note: JavaScript PDF extraction is workable, but PyMuPDF in Python is usually stronger for difficult scientific PDFs. A good later upgrade would be to let PaperDistill optionally use a small Python extraction worker while keeping the visual Electron interface.
