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

interface PromptFilePickerProps {
  value: string | null;
  onSelect: () => void;
  onUseDefault: () => void;
}

function PromptFilePicker({ value, onSelect, onUseDefault }: PromptFilePickerProps) {
  return (
    <div className="field-row">
      <label className="field-label">Prompt TXT File</label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose File…
        </button>
        <button type="button" onClick={onUseDefault}>
          Use Default Prompt
        </button>
        <span className="field-value">{value ?? "No prompt file selected"}</span>
      </div>
    </div>
  );
}

export default PromptFilePicker;
