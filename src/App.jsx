import React, { useState } from "react";
import { useFinanceStore } from "./hooks/useFinanceStore";
import { Navbar } from "./components/Navbar";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { InvoiceTable } from "./components/InvoiceTable";
import { InvoiceModal } from "./components/InvoiceModal";
import { MarkPaidModal } from "./components/MarkPaidModal";
import { InvoicePreviewModal } from "./components/InvoicePreviewModal";
import { ClientsModal } from "./components/ClientsModal";
import { SettingsModal } from "./components/SettingsModal";
import { CheckCircle2, AlertCircle } from "lucide-react";

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

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
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
      showToast(`Invoice ${invoiceData.invoiceNo} updated`);
    } else {
      store.addInvoice(invoiceData);
      showToast(`Created invoice ${invoiceData.invoiceNo}`);
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
      {/* Navigation Header */}
      <Navbar
        store={store}
        onOpenNewInvoice={handleOpenNewInvoice}
        onOpenClients={() => setIsClientsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onShowToast={showToast}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* 1. Executive Bento Grid Dashboard */}
        <DashboardMetrics
          store={store}
          showAnalytics={showAnalytics}
          onToggleAnalytics={() => setShowAnalytics((p) => !p)}
        />

        {/* 3. Main Invoice Ledger Grid */}
        <InvoiceTable
          store={store}
          onOpenEditInvoice={handleOpenEditInvoice}
          onOpenMarkPaid={handleOpenMarkPaid}
          onOpenPreviewInvoice={handleOpenPreviewInvoice}
          onShowToast={showToast}
        />
      </main>

      {/* Modals */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        initialData={editingInvoice}
        onSave={handleSaveInvoice}
        getNextInvoiceNumber={store.getNextInvoiceNumber}
        clients={store.clients}
      />

      <MarkPaidModal
        isOpen={isMarkPaidOpen}
        onClose={() => setIsMarkPaidOpen(false)}
        invoice={markingInvoice}
        onConfirm={(id, data) => {
          store.markInvoiceAsPaid(id, data);
          showToast(`Invoice ${markingInvoice?.invoiceNo} marked as Paid!`);
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
      />

      {/* Toast Notification Stack */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.type === "error" ? (
              <AlertCircle size={15} color="var(--status-overdue-text)" />
            ) : (
              <CheckCircle2 size={15} color="var(--status-received-text)" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default App;
