"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/components/DocumentExportModal.tsx
// Modal that generates, previews, and downloads all 3 AMTEC dispatch documents.
// Triggered from the Dispatch Detail page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

interface DocumentFile {
  filename: string;
  base64: string;
  mimeType: string;
}

interface GeneratedDocuments {
  dispatchForm:   DocumentFile;
  travelRequest:  DocumentFile;
  acceptanceForm: DocumentFile;
}

interface Props {
  dispatchId:     string;
  dispatchNumber: string;
  token:          string;
  onClose:        () => void;
}

type DocKey = keyof GeneratedDocuments;

const DOC_META: Record<DocKey, { label: string; icon: string; description: string }> = {
  dispatchForm: {
    label:       "Dispatch Form",
    icon:        "📋",
    description: "Official AMTEC dispatch record with instruments, machines, and itinerary.",
  },
  travelRequest: {
    label:       "Travel Request",
    icon:        "✈️",
    description: "Individual travel request forms for all assigned engineers and technicians.",
  },
  acceptanceForm: {
    label:       "SAL Acceptance Form",
    icon:        "🧪",
    description: "Sample acceptance form for the Agricultural Studies Laboratory.",
  },
};

export default function DocumentExportModal({ dispatchId, dispatchNumber, token, onClose }: Props) {
  const [status,    setStatus]    = useState<"idle" | "loading" | "done" | "error">("idle");
  const [documents, setDocuments] = useState<GeneratedDocuments | null>(null);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [emailSent, setEmailSent] = useState("");

  async function handleGenerate() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/dispatches/${dispatchId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Failed to generate documents.");
        setStatus("error");
        return;
      }
      setDocuments(json.documents);
      setEmailSent(json.emailSentTo ?? "");
      setStatus("done");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  function downloadFile(doc: DocumentFile) {
    const byteStr = atob(doc.base64);
    const bytes   = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: doc.mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    if (!documents) return;
    (Object.keys(documents) as DocKey[]).forEach(key => downloadFile(documents[key]));
  }

  return (
    // ── Backdrop ────────────────────────────────────────────────────────────
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: "#1B2A6B" }}>
          <div>
            <h2 className="text-white font-bold text-lg">Export Documents</h2>
            <p className="text-blue-200 text-xs mt-0.5 font-mono">{dispatchNumber}</p>
          </div>
          <button onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Idle state */}
          {status === "idle" && (
            <>
              <p className="text-sm text-gray-600">
                Generate all three official AMTEC documents for this dispatch. They will also be emailed to you automatically.
              </p>
              <div className="space-y-2">
                {(Object.keys(DOC_META) as DocKey[]).map(key => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="text-2xl">{DOC_META[key].icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{DOC_META[key].label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{DOC_META[key].description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Loading state */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="relative w-14 h-14">
                <svg className="animate-spin w-14 h-14" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="24" stroke="#E8ECF7" strokeWidth="4"/>
                  <path d="M28 4a24 24 0 0 1 24 24" stroke="#1B2A6B" strokeWidth="4" strokeLinecap="round"/>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl">📄</span>
              </div>
              <div className="text-center">
                <p className="text-gray-700 font-medium">Generating documents…</p>
                <p className="text-gray-400 text-xs mt-1">Building forms and sending email</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-700">Generation Failed</p>
              <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
            </div>
          )}

          {/* Done state */}
          {status === "done" && documents && (
            <>
              {/* Email confirmation */}
              {emailSent && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                  <span className="text-green-500 text-lg">✉️</span>
                  <p className="text-xs text-green-700">
                    Documents emailed to <strong>{emailSent}</strong>
                  </p>
                </div>
              )}

              {/* Individual download cards */}
              <div className="space-y-2">
                {(Object.keys(documents) as DocKey[]).map(key => {
                  const doc  = documents[key];
                  const meta = DOC_META[key];
                  return (
                    <div key={key}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">{meta.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                          <p className="text-xs text-gray-400 truncate">{doc.filename}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadFile(doc)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                        style={{ background: "#1B2A6B" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Download
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            {status === "done" ? "Close" : "Cancel"}
          </button>

          <div className="flex gap-2">
            {status === "error" && (
              <button onClick={handleGenerate}
                className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: "#1B2A6B" }}>
                Retry
              </button>
            )}
            {status === "idle" && (
              <button onClick={handleGenerate}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                style={{ background: "#1B2A6B" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Generate All Documents
              </button>
            )}
            {status === "done" && documents && (
              <button onClick={downloadAll}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                style={{ background: "#1B2A6B" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download All (3)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
