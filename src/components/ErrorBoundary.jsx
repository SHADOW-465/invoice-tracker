import React from "react";

/**
 * Catches render-time crashes.
 *
 * Without this, one bad record or one bug in a cell renderer blanks the entire
 * window - and because the app is the only way to reach the data, the user is
 * left with a white screen and no route to their invoices. So the fallback's most
 * important job is not apologising, it is getting the data back out.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, rescued: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[InvoiceLedger] render crash", error, info);
  }

  /**
   * Pull the ledger straight out of storage rather than from React state, which
   * is exactly what we cannot trust at this point.
   */
  rescueToFile = () => {
    try {
      const raw = localStorage.getItem("apex_finance_workspaces_v1") || "";
      if (!raw) {
        this.setState({ rescued: "No saved ledger was found in this browser." });
        return;
      }
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-ledger-rescue-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      let count = null;
      try {
        count = JSON.parse(raw).reduce((n, w) => n + (w.invoices ? w.invoices.length : 0), 0);
      } catch {
        /* still worth downloading even if it will not parse */
      }
      this.setState({
        rescued:
          count === null
            ? "Downloaded. The file could not be read here, but keep it - it may still be recoverable."
            : `Downloaded a copy containing ${count} invoices.`
      });
    } catch (e) {
      this.setState({ rescued: `Could not read storage: ${e.message}` });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="storage-guard-overlay" role="alertdialog" aria-modal="true">
        <div className="storage-guard-card">
          <div className="storage-guard-head">
            <div className="storage-guard-icon">!</div>
            <div>
              <h2 className="storage-guard-title">The app stopped unexpectedly</h2>
              <p className="storage-guard-sub">
                Something went wrong while drawing the screen. Your saved invoices have not been
                changed.
              </p>
            </div>
          </div>

          <div className="storage-guard-explain">
            <p>
              <strong>Nothing was deleted.</strong> This is a display problem, not a data problem —
              but take a copy of your ledger before doing anything else, just to be certain.
            </p>
            <p className="storage-guard-detail">
              Technical detail: {String(this.state.error?.message || this.state.error)}
            </p>
          </div>

          <div className="storage-guard-options">
            <div className="storage-guard-options-label">What to do</div>

            <div className="storage-option storage-option-best">
              <div className="storage-option-rank">1</div>
              <div className="storage-option-body">
                <div className="storage-option-title">Download a copy of your ledger</div>
                <p>Saves a backup file to your computer, straight from storage.</p>
                {this.state.rescued && <p className="storage-option-done">{this.state.rescued}</p>}
              </div>
              <button className="btn btn-primary" onClick={this.rescueToFile}>
                Download backup
              </button>
            </div>

            <div className="storage-option">
              <div className="storage-option-rank">2</div>
              <div className="storage-option-body">
                <div className="storage-option-title">Reload the app</div>
                <p>Most display problems clear on a reload. Your data is loaded fresh from storage.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>

          <div className="storage-guard-foot">
            If this keeps happening, send the downloaded backup file along with the technical detail
            above.
          </div>
        </div>
      </div>
    );
  }
}
