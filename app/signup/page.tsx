"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "admin_scheduler" | "AMaTS";

const ROLE_LABELS: Record<Role, string> = {
  admin_scheduler: "Scheduler / Admin",
  AMaTS: "AMaTS",
};

export default function SignupPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("admin_scheduler");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  async function handleSignup() {
    setMsg("");

    if (!fullName || !email || !password || !confirmPassword) {
      setMsgType("error");
      setMsg("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setMsgType("error");
      setMsg("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMsgType("error");
      setMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    // Step 1: Create auth user from browser (avoids server-side network issues)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError || !authData.user) {
    setMsgType("error");
    setMsg(authError?.message ?? "Signup failed.");
    setLoading(false);
    return;
    }

    // Step 2: Create profile via API
    const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: authData.user.id, full_name: fullName, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
    setMsgType("error");
    setMsg(data.error ?? "Signup failed. Please try again.");
    return;
    }

    setMsgType("success");
    setMsg("Account created! Please wait for an admin to activate your account before logging in.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F4F6FB" }}>
      <div className="w-full max-w-md">

        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow"
            style={{ background: "#1B2A6B" }}>
            <img src="/amtec-logo.png" alt="AMTEC" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Create an Account</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            AMTEC Dispatch Scheduler — request access below
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {msgType === "success" && msg ? (
            // Success state
            <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{ background: "#DCFCE7" }}>
                ✓
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Account Submitted!</p>
                <p className="text-sm text-gray-500 mt-1">{msg}</p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="mt-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "#1B2A6B", color: "white" }}>
                Go to Login
              </button>
            </div>
          ) : (
            // Form
            <div className="px-8 py-8 space-y-4">

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Full Name
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                  placeholder="e.g. Juan Dela Cruz"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="py-2.5 px-3 rounded-lg border text-sm font-medium transition-all"
                      style={{
                        borderColor: role === r ? "#1B2A6B" : "#D1D5DB",
                        background: role === r ? "#1B2A6B" : "white",
                        color: role === r ? "white" : "#374151",
                      }}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>

              {/* Error message */}
              {msg && msgType === "error" && (
                <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{msg}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSignup}
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ background: "#1B2A6B", color: "white" }}>
                {loading ? "Creating account..." : "Create Account"}
              </button>

              {/* Login link */}
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <button
                  onClick={() => router.push("/login")}
                  className="font-semibold hover:underline"
                  style={{ color: "#1B2A6B" }}>
                  Log in
                </button>
              </p>

            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          AMTEC UPLB — Agricultural Machinery Testing and Evaluation Center
        </p>
      </div>
    </div>
  );
}
