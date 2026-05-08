"use client";

import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/app/components/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/client";

interface MachineData {
  id: string;
  machine: string;
  tests: string[];
}

export default function MachineTestsPage() {
  const [search, setSearch] = useState("");
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineData | null>(null);
  
  // Form state
  const [formMachineName, setFormMachineName] = useState("");
  const [formTests, setFormTests] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amats/machine-tests");
      const data = await res.json();
      if (data.detailed) {
        setMachines(data.detailed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMachines = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return machines;
    return machines.filter(
      (m) =>
        m.machine.toLowerCase().includes(query) ||
        m.tests.some((t) => t.toLowerCase().includes(query))
    );
  }, [search, machines]);

  const openAddModal = () => {
    setEditingMachine(null);
    setFormMachineName("");
    setFormTests([""]);
    setIsModalOpen(true);
  };

  const openEditModal = (machine: MachineData) => {
    setEditingMachine(machine);
    setFormMachineName(machine.machine);
    setFormTests(machine.tests.length > 0 ? [...machine.tests] : [""]);
    setIsModalOpen(true);
  };

  const handleTestChange = (index: number, value: string) => {
    const newTests = [...formTests];
    newTests[index] = value;
    setFormTests(newTests);
  };

  const addTestLine = () => {
    setFormTests([...formTests, ""]);
  };

  const removeTestLine = (index: number) => {
    const newTests = formTests.filter((_, i) => i !== index);
    setFormTests(newTests.length > 0 ? newTests : [""]);
  };

  const handleSave = async () => {
    if (!formMachineName.trim()) {
      alert("Machine name is required.");
      return;
    }
    
    const cleanTests = formTests.map(t => t.trim()).filter(t => t.length > 0);
    
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const isEdit = !!editingMachine;
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit 
        ? { id: editingMachine.id, machine: formMachineName, tests: cleanTests }
        : { machine: formMachineName, tests: cleanTests };

      const res = await fetch("/api/amats/machine-tests", {
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
      fetchMachines();
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

      const res = await fetch(`/api/amats/machine-tests?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to delete");
      
      fetchMachines();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppLayout>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Machines & Tests</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage the reference list of all testing machines and their respective tests.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-[#8C1515] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Machine
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by machine or test name..."
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1515]"
          />
          <div className="mt-3 text-xs text-gray-500">
            Showing {filteredMachines.length} of {machines.length} machines
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading machines...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="px-6 py-4 w-1/3">Machine Name</th>
                  <th className="px-6 py-4">Tests Available</th>
                  <th className="px-6 py-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMachines.length > 0 ? (
                  filteredMachines.map((machine) => (
                    <tr key={machine.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <span className="font-semibold text-gray-800">{machine.machine}</span>
                        <div className="text-xs text-gray-400 mt-1">{machine.tests.length} test{machine.tests.length !== 1 && "s"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <ul className="list-disc pl-4 space-y-1">
                          {machine.tests.map((test, idx) => (
                            <li key={idx} className="text-gray-600">{test}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEditModal(machine)} className="text-[#8C1515] hover:text-red-800 font-medium transition-colors">Edit</button>
                          <button onClick={() => handleDelete(machine.id, machine.machine)} className="text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                      No machines or tests match your search.
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingMachine ? "Edit Machine" : "Add Machine"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="px-6 py-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Machine Name *</label>
                  <input 
                    type="text" 
                    value={formMachineName} 
                    onChange={e => setFormMachineName(e.target.value)} 
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1515]" 
                    placeholder="e.g. Walking-Type Agricultural Tractor"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">Tests Available</label>
                    <button type="button" onClick={addTestLine} className="text-xs font-bold text-[#8C1515] hover:text-red-800 transition-colors">+ Add Test</button>
                  </div>
                  <div className="space-y-2">
                    {formTests.map((test, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={test} 
                          onChange={e => handleTestChange(index, e.target.value)} 
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1515]" 
                          placeholder="e.g. Maximum power test"
                        />
                        <button type="button" onClick={() => removeTestLine(index)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Remove test">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
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
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[#8C1515] hover:bg-red-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Machine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
