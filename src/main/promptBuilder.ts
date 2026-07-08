const PLACEHOLDER_PDF_TEXT = "{{PDF_TEXT}}";
const PLACEHOLDER_PDF_FILENAME = "{{PDF_FILENAME}}";
const PLACEHOLDER_PDF_PATH = "{{PDF_PATH}}";
const PLACEHOLDER_PAGE_COUNT = "{{PAGE_COUNT}}";

export interface PromptBuilderInput {
  promptTemplate: string;
  pdfText: string;
  pdfFileName: string;
  pdfPath: string;
  pageCount: number;
}

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

export function buildPrompt(input: PromptBuilderInput): string {
  const hasPdfTextPlaceholder = input.promptTemplate.includes(PLACEHOLDER_PDF_TEXT);

  let result = input.promptTemplate;
  result = replaceAll(result, PLACEHOLDER_PDF_FILENAME, input.pdfFileName);
  result = replaceAll(result, PLACEHOLDER_PDF_PATH, input.pdfPath);
  result = replaceAll(result, PLACEHOLDER_PAGE_COUNT, String(input.pageCount));

  if (hasPdfTextPlaceholder) {
    return replaceAll(result, PLACEHOLDER_PDF_TEXT, input.pdfText);
  }

  return `${result}\n\n---\n\nPDF FILE:\n${input.pdfFileName}\n\nEXTRACTED PDF TEXT:\n${input.pdfText}`;
}
