import React from "react";

/** First run on the desktop build: point the app at the workbook you already keep. */
export function Welcome({ onChoose, error }) {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="brand-mark" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 15 }}>F</div>
        <h1 style={{ marginTop: 18 }}>FinanceOS</h1>
        <p className="sub" style={{ marginBottom: 22 }}>
          Choose the Excel workbook you already keep your invoices in. It stays exactly where it is —
          FinanceOS reads and writes that file directly, and takes a snapshot before every save.
        </p>
        <button className="btn btn-primary" onClick={onChoose}>Choose workbook…</button>
        {error && <div className="banner" style={{ marginTop: 20 }}>⚠ {error}</div>}
        <div className="welcome-note">
          Expected columns: Invoice #, Client Name, Actual Invoiced Amt, UOM, Raised on, Collection
          Status, Received on, Remarks. Anything missing is derived; nothing is discarded.
        </div>
      </div>
    </div>
  );
}
