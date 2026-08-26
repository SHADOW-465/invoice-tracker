import React, { useState } from "react";
import { useFinanceStore } from "./hooks/useFinanceStore";
import { Navbar } from "./components/Navbar";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { InvoiceTable } from "./components/InvoiceTable";
import { InvoiceModal } from "./components/InvoiceModal";
import { MarkPaidModal } from "./components/MarkPaidModal";
import { InvoicePreviewModal } from "./components/InvoicePreviewModal";
import { ClientsModal } from "./components/ClientsModal";
import { SettingsModal } from "./components/SettingsModal";
import { StorageGuard } from "./components/StorageGuard";
import { HistoryView } from "./components/HistoryView";
import { CheckCircle2, AlertCircle, Trash2, Info, Check } from "lucide-react";

export function App() {
  const store = useFinanceStore();

  // Analytics toggle (starts expanded or collapsed)
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Modal states
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [markingInvoice, setMarkingInvoice] = useState(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  const [isClientsOpen, setIsClientsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appView, setAppView] = useState("ledger");

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers
  const handleOpenNewInvoice = () => {
    setEditingInvoice(null);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = (invoiceData) => {
    if (editingInvoice) {
      store.updateInvoice(editingInvoice.id, invoiceData);
      showToast(`Updated Invoice #${invoiceData.invoiceNo}`);
    } else {
      store.addInvoice(invoiceData);
      showToast(`Created Invoice #${invoiceData.invoiceNo} successfully!`);
    }
  };

  const handleOpenMarkPaid = (invoice) => {
    setMarkingInvoice(invoice);
    setIsMarkPaidOpen(true);
  };

  const handleOpenPreviewInvoice = (invoice) => {
    setPreviewInvoice(invoice);
    setIsPreviewOpen(true);
  };

  return (
    <div className="app-container">
      {/* Storage trouble is otherwise invisible: the UI keeps accepting edits that
          never reached disk. StorageGuard explains what happened and what to do -
          blocking the app when data is at risk, warning persistently when it is not. */}
      <StorageGuard store={store} onShowToast={showToast} />

      {/* Navigation Header */}
      <Navbar
        store={store}
        onOpenNewInvoice={handleOpenNewInvoice}
        onOpenClients={() => setIsClientsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setAppView("history")}
        appView={appView}
        onGoToLedger={() => setAppView("ledger")}
        onShowToast={showToast}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {appView === "history" ? (
          <HistoryView
            store={store}
            onBack={() => setAppView("ledger")}
            onOpenInvoice={handleOpenEditInvoice}
            onShowToast={showToast}
          />
        ) : (
          <>
            <DashboardMetrics
              store={store}
              showAnalytics={showAnalytics}
              onToggleAnalytics={() => setShowAnalytics((p) => !p)}
              onShowToast={showToast}
            />
            <InvoiceTable
              store={store}
              onOpenEditInvoice={handleOpenEditInvoice}
              onOpenMarkPaid={handleOpenMarkPaid}
              onOpenPreviewInvoice={handleOpenPreviewInvoice}
              onShowToast={showToast}
            />
          </>
        )}
      </main>

      {/* Modals */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        initialData={editingInvoice}
        onSave={handleSaveInvoice}
        getNextInvoiceNumber={store.getNextInvoiceNumber}
        clients={store.clients}
        existingInvoices={store.invoices}
      />

      <MarkPaidModal
        isOpen={isMarkPaidOpen}
        onClose={() => setIsMarkPaidOpen(false)}
        invoice={markingInvoice}
        onConfirm={(id, data) => {
          store.markInvoiceAsPaid(id, data);
          showToast(
            data.status === "Partially Paid"
              ? `Invoice #${markingInvoice?.invoiceNo} recorded as partially paid`
              : `Invoice #${markingInvoice?.invoiceNo} settled & marked as Paid!`
          );
        }}
      />

      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={previewInvoice}
        settings={store.settings}
        onShowToast={showToast}
      />

      <ClientsModal
        isOpen={isClientsOpen}
        onClose={() => setIsClientsOpen(false)}
        store={store}
        onShowToast={showToast}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={store.settings}
        onSaveSettings={store.setSettings}
        onShowToast={showToast}
        store={store}
      />

      {/* Toast Notification Stack */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => {
          let icon = <CheckCircle2 size={16} className="toast-icon-success" />;
          if (t.type === "error") {
            icon = <AlertCircle size={16} className="toast-icon-error" />;
          } else if (t.type === "delete") {
            icon = <Trash2 size={16} className="toast-icon-delete" />;
          } else if (t.type === "info") {
            icon = <Info size={16} className="toast-icon-info" />;
          } else if (t.type === "copy") {
            icon = <Check size={16} className="toast-icon-copy" />;
          }

          return (
            <div
              key={t.id}
              className="toast"
              onClick={() => dismissToast(t.id)}
              title="Click to dismiss"
            >
              {icon}
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default App;
