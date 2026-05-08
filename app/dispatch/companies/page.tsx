"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/client";

interface CompanyData {
  id: string;
  name: string;
  contact_person: string | null;
  contact_number: string | null;
  address: string | null;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formContactNumber, setFormContactNumber] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id })
      });
      const data = await res.json();
      
      if (!data.profile || data.profile.role !== "admin_scheduler") {
        router.push("/dashboard");
        return;
      }

      setUserRole(data.profile.role);
      fetchCompanies();
    };

    init();
  }, [router]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      if (data.companies) {
        setCompanies(data.companies);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.contact_person && c.contact_person.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query))
    );
  }, [search, companies]);

  const openAddModal = () => {
    setEditingCompany(null);
    setFormName("");
    setFormContactPerson("");
    setFormContactNumber("");
    setFormAddress("");
    setIsModalOpen(true);
  };

  const openEditModal = (company: CompanyData) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormContactPerson(company.contact_person || "");
    setFormContactNumber(company.contact_number || "");
    setFormAddress(company.address || "");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert("Company name is required.");
      return;
    }
    
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const isEdit = !!editingCompany;
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit 
        ? { 
            id: editingCompany.id, 
            name: formName.trim(), 
            contact_person: formContactPerson.trim() || null, 
            contact_number: formContactNumber.trim() || null, 
            address: formAddress.trim() || null 
          }
        : { 
            name: formName.trim(), 
            contact_person: formContactPerson.trim() || null, 
            contact_number: formContactNumber.trim() || null, 
            address: formAddress.trim() || null 
          };

      const res = await fetch("/api/companies", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save");
      }

      setIsModalOpen(false);
      fetchCompanies();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

    try {
      const supabase = supabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/companies", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ id })
      });

      if (!res.ok) throw new Error("Failed to delete");
      
      fetchCompanies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!userRole) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage the reference list of companies and clients for Dispatches.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Company
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name, contact person, or address..."
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <div className="mt-3 text-xs text-gray-500">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading companies...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="px-6 py-4 w-1/3">Company Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <span className="font-semibold text-gray-800">{company.name}</span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {company.contact_person && (
                          <div className="text-gray-800 font-medium">{company.contact_person}</div>
                        )}
                        {company.contact_number && (
                          <div className="text-gray-500 text-xs mt-1">{company.contact_number}</div>
                        )}
                        {!company.contact_person && !company.contact_number && (
                          <span className="text-gray-400 italic text-xs">No contact info</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-gray-600">
                        {company.address || <span className="text-gray-400 italic text-xs">No address</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEditModal(company)} className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors">Edit</button>
                          <button onClick={() => handleDelete(company.id, company.name)} className="text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      No companies match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingCompany ? "Edit Company" : "Add Company"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="px-6 py-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Company Name *</label>
                  <input 
                    type="text" 
                    value={formName} 
                    onChange={e => setFormName(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Contact Person</label>
                  <input 
                    type="text" 
                    value={formContactPerson} 
                    onChange={e => setFormContactPerson(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Contact Number</label>
                  <input 
                    type="text" 
                    value={formContactNumber} 
                    onChange={e => setFormContactNumber(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                    placeholder="e.g. +63 912 345 6789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Address</label>
                  <textarea 
                    value={formAddress} 
                    onChange={e => setFormAddress(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-y" 
                    placeholder="e.g. 123 Industry Road, Laguna"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Company"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
