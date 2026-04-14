"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";

const TRANSPORT_LABELS: Record<string, string> = {
  public_conveyance: "Public Conveyance",
  test_applicant_vehicle: "Test Applicant Vehicle",
  college_vehicle: "College Vehicle",
  other: "Other",
};

const TYPE_LABELS: Record<string, string> = {
  on_field: "On Field",
  in_house: "In-house",
};

// ─── Status ──────────────────────────────────────────────────────────────────
type DispatchStatus = "Pending" | "Scheduled" | "Re-scheduled" | "Ongoing" | "Cancelled" | "Done" | "Unknown";



const STATUS_STYLES: Record<DispatchStatus, { bg: string; color: string }> = {
  Pending:        { bg: "#FEF3C7", color: "#92400E" },
  Scheduled:      { bg: "#EEF1FB", color: "#1B2A6B" },
  "Re-scheduled": { bg: "#FDE68A", color: "#78350F" },
  Ongoing:        { bg: "#DBEAFE", color: "#1E40AF" },
  Cancelled:      { bg: "#FEE2E2", color: "#991B1B" },
  Done:           { bg: "#D1FAE5", color: "#065F46" },
  Unknown:        { bg: "#F3F4F6", color: "#6B7280" },
};

function StatusBadge({ status }: { status: string }) {
  const key = (status || "Unknown") as DispatchStatus;
  const s = STATUS_STYLES[key] ?? STATUS_STYLES.Unknown;
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.color }}>
      {key}
    </span>
  );
}

export default function DispatchDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [dispatch, setDispatch] = useState<any>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [token, setToken] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }

      const meRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const meData = await meRes.json();
      setRole(meData.profile?.role ?? "");

      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) { router.push("/login"); return; }
      setToken(accessToken);

      const res = await fetch(`/api/dispatches/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load"); setLoading(false); return; }
      setDispatch(json.dispatch);
      setLoading(false);
    }
    load();
  }, [id, router, supabase]);

  async function handleExportPdf() {
    if (!token) return;
    setExportingPdf(true);
    try {
      const res = await fetch(`/api/dispatches/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispatch-${dispatch?.dispatch_number ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading dispatch...</p>
    </div>
  );

  if (error || !dispatch) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500 text-sm">{error || "Dispatch not found."}</p>
    </div>
  );

  const instruments = dispatch.dispatch_instruments ?? [];
  const itinerary = dispatch.dispatch_itinerary ?? [];
  const machines = dispatch.dispatch_machines ?? [];
  const canEdit = ["admin_scheduler", "AMaTS"].includes(role);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Dispatch Record</p>
              <h1 className="text-3xl font-bold text-gray-900 font-mono">
                {dispatch.dispatch_number ?? "No Number"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Created {new Date(dispatch.created_at).toLocaleDateString("en-PH", {
                  year: "numeric", month: "long", day: "numeric"
                })}
              </p>
              <div className="mt-3">
                <StatusBadge status={dispatch.status} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Link href="/dispatches"
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700">
                ← Back to List
              </Link>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="px-4 py-2 text-sm border rounded flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  borderColor: "#1B2A6B",
                  color: exportingPdf ? "#6B7280" : "#1B2A6B",
                  background: "white",
                }}>
                {exportingPdf ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    Export PDF
                  </>
                )}
              </button>
              {canEdit && (
                <Link href={`/dispatches/${dispatch.id}/edit`}
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                  style={{ background: "#1B2A6B" }}>
                  Edit Dispatch
                </Link>
              )}
            </div>
          </div>

          {/* Main Info */}
          <Section title="Dispatch Information">
            <Grid>
              <Field label="Company Name" value={dispatch.company_name} />
              <Field label="Contact Info" value={dispatch.contact_info} />
              <Field label="Date From" value={dispatch.date_from} />
              <Field label="Date To" value={dispatch.date_to} />
              <Field label="Type" value={TYPE_LABELS[dispatch.type] ?? dispatch.type} />
              <Field label="Location" value={dispatch.type === "in_house" ? "AMTEC" : dispatch.testing_location} />
              <Field label="Transport Mode" value={TRANSPORT_LABELS[dispatch.transport_mode] ?? dispatch.transport_mode} />
              {dispatch.transport_mode === "other" && (
                <Field label="Transport (Other)" value={dispatch.transport_other_text} />
              )}
              <Field label="Is Extended" value={dispatch.is_extended ? "Yes" : "No"} />
              {dispatch.is_extended && (
                <Field label="Extended Days" value={String(dispatch.extended_days ?? "—")} />
              )}
            </Grid>
            {dispatch.remarks_observation && (
              <NoteField label="Remarks / Observation" value={dispatch.remarks_observation} />
            )}
            {dispatch.notes && (
              <NoteField label="Notes" value={dispatch.notes} />
            )}
          </Section>

          {/* Personnel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Engineers">
              {(() => {
                const engineers = (dispatch.dispatch_assignments ?? []).filter((a: any) => ['engineer', 'lead_engineer', 'assistant_engineer'].includes(a.assignment_type));
                return engineers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No engineers assigned.</p>
                ) : (
                  <ul className="space-y-1">
                    {engineers.map((e: any) => (
                      <li key={e.id} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                        {e.staff?.full_name ?? e.profiles?.full_name ?? "Unknown"}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Section>
            <Section title="Technicians">
              {(() => {
                const technicians = (dispatch.dispatch_assignments ?? []).filter((a: any) => a.assignment_type === 'technician');
                return technicians.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No technicians assigned.</p>
                ) : (
                  <ul className="space-y-1">
                    {technicians.map((t: any) => (
                      <li key={t.id} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                        {t.staff?.full_name ?? t.profiles?.full_name ?? "Unknown"}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Section>
          </div>

          {/* Instruments */}
          <Section title="Instruments">
            {instruments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No instruments recorded.</p>
            ) : (
              <TableWrapper>
                <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                    <Th>Instrument Name</Th>
                    <Th>Code / Brand / Model</Th>
                    <Th>Before Travel</Th>
                    <Th>Remarks</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {instruments.map((i: any) => (
                    <tr key={i.id} className="text-sm text-gray-700">
                      <Td>{i.instrument_name ?? "—"}</Td>
                      <Td>{i.code_brand_model ?? "—"}</Td>
                      <Td>{i.before_travel ?? "—"}</Td>
                      <Td>{i.remarks ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Section>

          {/* Itinerary */}
          <Section title="Itinerary">
            {itinerary.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No itinerary recorded.</p>
            ) : (
              <TableWrapper>
                <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                    <Th>Date</Th><Th>Accommodation</Th>
                    <Th>B</Th><Th>L</Th><Th>D</Th>
                    <Th>Time of Travel</Th><Th>Working Hrs</Th>
                    <Th>OT Offset</Th><Th>OT Billing</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itinerary.map((row: any) => (
                    <tr key={row.id} className="text-sm text-gray-700">
                      <Td>{row.travel_date ?? "—"}</Td>
                      <Td>{row.per_diem_accommodation ?? "—"}</Td>
                      <Td>{row.per_diem_b ?? "—"}</Td>
                      <Td>{row.per_diem_l ?? "—"}</Td>
                      <Td>{row.per_diem_d ?? "—"}</Td>
                      <Td>{row.time_of_travel ?? "—"}</Td>
                      <Td>{row.working_hours ?? "—"}</Td>
                      <Td>{row.overtime_offset ?? "—"}</Td>
                      <Td>{row.overtime_billing ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Section>

          {/* Machines */}
          <Section title="Machines">
            {machines.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No machines recorded.</p>
            ) : (
              <TableWrapper>
                <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                    <Th>TAM No.</Th><Th>Machine</Th><Th>Brand</Th>
                    <Th>Model</Th><Th>Serial No.</Th><Th>Date of Test</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {machines.map((m: any) => (
                    <tr key={m.id} className="text-sm text-gray-700">
                      <Td>{m.tam_no ?? "—"}</Td>
                      <Td>{m.machine ?? "—"}</Td>
                      <Td>{m.brand ?? "—"}</Td>
                      <Td>{m.model ?? "—"}</Td>
                      <Td>{m.serial_no ?? "—"}</Td>
                      <Td>{m.date_of_test ?? "—"}</Td>
                      <Td>
                        {m.status ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              background: m.status === "Passed" ? "#D1FAE5" : "#FEE2E2",
                              color: m.status === "Passed" ? "#065F46" : "#991B1B",
                            }}>
                            {m.status}
                          </span>
                        ) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </Section>

        </div>
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function NoteField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3 border border-gray-100">{value}</p>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3">{children}</td>;
}
