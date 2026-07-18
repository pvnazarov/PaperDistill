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

interface LogPanelProps {
  lines: string[];
}

function LogPanel({ lines }: LogPanelProps) {
  return (
    <section className="log-panel">
      <h2>Log</h2>
      <div className="log-panel-body">
        {lines.length === 0 ? (
          <p className="log-panel-empty">No activity yet.</p>
        ) : (
          lines.map((line, index) => (
            <div key={index} className="log-line">
              {line}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default LogPanel;
