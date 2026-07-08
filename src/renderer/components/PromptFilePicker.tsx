interface PromptFilePickerProps {
  value: string | null;
  onSelect: () => void;
}

function PromptFilePicker({ value, onSelect }: PromptFilePickerProps) {
  return (
    <div className="field-row">
      <label className="field-label">Prompt TXT File</label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose File…
        </button>
        <span className="field-value">{value ?? "No prompt file selected"}</span>
      </div>
    </div>
  );
}

export default PromptFilePicker;
