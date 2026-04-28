// ─────────────────────────────────────────────────────────────────────────────
// app/api/dispatches/[id]/documents/route.ts
// Generates Dispatch Form, Travel Request, and Acceptance Form as DOCX.
// Returns base64-encoded files for preview/download + sends email via Resend.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/requireAccess";
import { Resend } from "resend";

import { generateDispatchForm }   from "@/lib/documents/generators/dispatch-form";
import { generateTravelRequest }  from "@/lib/documents/generators/travel-request";
import { generateAcceptanceForm } from "@/lib/documents/generators/acceptance-form";
import type { DocumentDispatchData } from "@/lib/documents/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth (uses your real getAuthUser from requireAccess.ts) ───────────────
  const auth = await getAuthUser(req);
  if (!auth.ok) return auth.response;

  // Initialize Resend inside the handler to avoid build-time errors
  const resend = new Resend(process.env.RESEND_API_KEY || "missing_key");


  const { id } = await params;

  // ── Fetch full dispatch data ───────────────────────────────────────────────
  const { data: dispatch, error } = await supabaseAdmin
    .from("dispatches")
    .select(`
      *,
      dispatch_assignments (
        id, staff_id, profile_id, assignment_type, is_override, override_reason,
        staff ( full_name, initials, designation, email )
      ),
      dispatch_instruments ( * ),
      dispatch_itinerary   ( * ),
      dispatch_machines    ( * )
    `)
    .eq("id", id)
    .single();

  if (error || !dispatch) {
    return NextResponse.json(
      { error: error?.message ?? "Dispatch not found" },
      { status: 404 }
    );
  }

  const dispatchData   = dispatch as unknown as DocumentDispatchData;
  const dispatchNumber = dispatch.dispatch_number ?? id;

  // ── Generate all three documents in parallel ──────────────────────────────
  let dispatchFormBuffer:   Buffer;
  let travelRequestBuffer:  Buffer;
  let acceptanceFormBuffer: Buffer;

  try {
    [dispatchFormBuffer, travelRequestBuffer, acceptanceFormBuffer] = await Promise.all([
      generateDispatchForm(dispatchData),
      generateTravelRequest(dispatchData),
      generateAcceptanceForm(dispatchData),
    ]);
  } catch (genErr: any) {
    console.error("Document generation error:", genErr);
    return NextResponse.json(
      { error: `Document generation failed: ${genErr.message}` },
      { status: 500 }
    );
  }

  // ── File names ────────────────────────────────────────────────────────────
  const safeNum            = dispatchNumber.replace(/[^a-zA-Z0-9\-_]/g, "_");
  const dispatchFormName   = `Dispatch_Form_${safeNum}.docx`;
  const travelRequestName  = `Travel_Request_${safeNum}.docx`;
  const acceptanceFormName = `Acceptance_Form_${safeNum}.docx`;

  // ── Build recipient list ──────────────────────────────────────────────────
  // NOTE: Resend's "onboarding@resend.dev" sender (sandbox) can ONLY deliver
  // to the Resend account owner's verified email. Any other address in `to`
  // gets silently dropped. Fix: send TO the admin email only, but list all
  // assigned personnel in the email body so the admin can forward accordingly.
  // To send directly to engineer emails, verify a domain in Resend and update
  // the `from` address to e.g. "dispatch@yourdomain.com".
  const baseRecipient = process.env.DOCUMENTS_RECIPIENT_EMAIL ?? "mjcruz0319@gmail.com";

  const assignedPersonnel = (dispatch.dispatch_assignments ?? [])
    .filter((a: any) => a.staff)
    .map((a: any) => ({
      name:  a.staff?.full_name ?? "Unknown",
      email: a.staff?.email ?? null,
      role:  a.assignment_type ?? "",
    }));

  const personnelHtml = assignedPersonnel.length > 0
    ? `<h3 style="color:#1B2A6B;margin-top:20px;">Assigned Personnel</h3>
       <table style="border-collapse:collapse;width:100%;font-size:13px;color:#444;">
         <tr style="background:#EEF1FB;">
           <th style="padding:6px 10px;text-align:left;border:1px solid #ddd;">Name</th>
           <th style="padding:6px 10px;text-align:left;border:1px solid #ddd;">Role</th>
           <th style="padding:6px 10px;text-align:left;border:1px solid #ddd;">Email</th>
         </tr>
         ${assignedPersonnel.map((p: {name:string;email:string|null;role:string}) => `
           <tr>
             <td style="padding:6px 10px;border:1px solid #ddd;">${p.name}</td>
             <td style="padding:6px 10px;border:1px solid #ddd;">${p.role.replace(/_/g," ")}</td>
             <td style="padding:6px 10px;border:1px solid #ddd;">${p.email ?? "—"}</td>
           </tr>`).join("")}
       </table>
       <p style="color:#888;font-size:12px;margin-top:8px;">
         ⚠️ Please forward this email (with attachments) to the assigned engineers above.
       </p>`
    : "";

  let emailError: string | null = null;

  try {
    const sendResult = await resend.emails.send({
      from: "AMTEC Dispatch <onboarding@resend.dev>",
      to:   [baseRecipient],   // sandbox only delivers to verified account email
      subject: `AMTEC Documents — ${dispatchNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1B2A6B; margin-bottom: 8px;">AMTEC Calendar Dispatch</h2>
          <p style="color: #444;">Documents have been generated for dispatch
            <strong>${dispatchNumber}</strong>:</p>
          <ul style="color: #444; line-height: 1.8;">
            <li>📋 Dispatch Form</li>
            <li>✈️ Travel Request</li>
            <li>📄 SAL Sample Acceptance Form</li>
          </ul>
          ${personnelHtml}
          <p style="color: #444;margin-top:16px;">All three documents are attached.</p>
          <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
          <p style="color: #aaa; font-size: 12px;">
            Generated by AMTEC Calendar Dispatch System
          </p>
        </div>
      `,
      attachments: [
        { filename: dispatchFormName,   content: dispatchFormBuffer.toString("base64") },
        { filename: travelRequestName,  content: travelRequestBuffer.toString("base64") },
        { filename: acceptanceFormName, content: acceptanceFormBuffer.toString("base64") },
      ],
    });

    // Resend returns an error object if the send failed (doesn't always throw)
    if ((sendResult as any).error) {
      emailError = (sendResult as any).error?.message ?? "Unknown Resend error";
      console.error("Resend returned error:", emailError);
    }
  } catch (emailErr: any) {
    emailError = emailErr?.message ?? "Email send exception";
    console.error("Email send exception:", emailErr);
  }

  // ── Return documents as base64 for client-side preview + download ─────────
  return NextResponse.json({
    success:      true,
    dispatchNumber,
    emailSentTo:  emailError ? null : baseRecipient,
    emailError,
    assignedPersonnel: assignedPersonnel.map((p: {name:string;email:string|null;role:string}) => ({ name: p.name, email: p.email, role: p.role })),
    documents: {
      dispatchForm: {
        filename: dispatchFormName,
        base64:   dispatchFormBuffer.toString("base64"),
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      travelRequest: {
        filename: travelRequestName,
        base64:   travelRequestBuffer.toString("base64"),
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      acceptanceForm: {
        filename: acceptanceFormName,
        base64:   acceptanceFormBuffer.toString("base64"),
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    },
  });
}
