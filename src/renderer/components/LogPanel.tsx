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
