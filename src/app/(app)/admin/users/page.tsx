"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getRoleDisplayName } from "@/lib/utils";

interface UserData {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  jobRoleId: string | null;
  team: string | null;
  role: string;
  isActive: boolean;
  managerId: string | null;
  manager: { id: string; name: string } | null;
}

interface JobRoleOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface InvitationData {
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
  usedAt: string | null;
  createdAt: string;
}

const ROLES = ["EMPLOYEE", "MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"];

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newInvite, setNewInvite] = useState({ name: "", email: "", jobTitle: "", team: "", role: "EMPLOYEE", managerId: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; invited: number; skipped: number; emailsSent: number; results: { email: string; status: string; emailSent?: boolean }[] } | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [copiedJoinLink, setCopiedJoinLink] = useState(false);
  const [pasteData, setPasteData] = useState("");
  const [jobRoles, setJobRoles] = useState<JobRoleOption[]>([]);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    loadUsers();
    loadInvitations();
    fetch("/api/admin/roles").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setJobRoles(data.map((r: JobRoleOption) => ({ id: r.id, name: r.name, isActive: r.isActive })));
    });
  }, [session, router]);

  function loadUsers() {
    fetch("/api/admin/users").then((r) => r.json()).then(setUsers);
  }

  function loadInvitations() {
    fetch("/api/admin/invitations").then((r) => r.json()).then(setInvitations);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newInvite),
    });
    if (res.ok) {
      setShowInviteForm(false);
      setNewInvite({ name: "", email: "", jobTitle: "", team: "", role: "EMPLOYEE", managerId: "" });
      loadInvitations();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create invitation");
    }
    setCreating(false);
  }

  async function updateUser(userId: string, data: Record<string, unknown>) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...data }),
    });
    loadUsers();
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  function copyInviteLink(token: string) {
    navigator.clipboard.writeText(getInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function resendEmail(invitationId: string) {
    setResendingEmail(invitationId);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (data.success) {
        setResendingEmail("sent-" + invitationId);
        setTimeout(() => setResendingEmail(null), 2000);
      } else {
        setError(data.error || "Failed to send email");
        setResendingEmail(null);
      }
    } catch {
      setError("Failed to send email");
      setResendingEmail(null);
    }
  }

  async function doImport(file: File) {
    setImporting(true);
    setImportResult(null);
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        loadInvitations();
      } else {
        setError(data.error || "Import failed");
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleCsvImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;
    await doImport(file);
    fileInput.value = "";
  }

  async function handlePasteImport() {
    const text = pasteData.trim();
    if (!text) return;
    const file = new File([text], "paste.csv", { type: "text/csv" });
    await doImport(file);
    setPasteData("");
  }

  async function deleteUser(userId: string) {
    setDeleting(true);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setConfirmDeleteId(null);
      loadUsers();
    }
    setDeleting(false);
  }

  const managers = users.filter((u) => ["MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"].includes(u.role));
  const pendingInvitations = invitations.filter((i) => !i.usedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">User Management</h1>
          <p className="text-sm text-gray-600 mt-1">Invite users and manage roles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join`); setCopiedJoinLink(true); setTimeout(() => setCopiedJoinLink(false), 2000); }}>
            {copiedJoinLink ? "Copied!" : "Copy Join Link"}
          </Button>
          <Button variant="secondary" onClick={() => { setShowImport(!showImport); setShowInviteForm(false); }}>
            {showImport ? "Cancel" : "Bulk Import"}
          </Button>
          <Button onClick={() => { setShowInviteForm(!showInviteForm); setShowImport(false); }}>
            {showInviteForm ? "Cancel" : "Invite User"}
          </Button>
        </div>
      </div>

      {showInviteForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Invite New User</h2>
            <p className="text-xs text-gray-500">They will receive a link to set their own password</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  value={newInvite.name}
                  onChange={(e) => setNewInvite((u) => ({ ...u, name: e.target.value }))}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite((u) => ({ ...u, email: e.target.value }))}
                  required
                />
                <div>
                  <label className="block text-sm font-semibold text-visory-navy mb-1">Job Role</label>
                  <input
                    list="job-role-options"
                    value={newInvite.jobTitle}
                    onChange={(e) => setNewInvite((u) => ({ ...u, jobTitle: e.target.value }))}
                    placeholder="Pick a role or type a new one"
                    className="block w-full rounded-lg border border-visory-border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory"
                  />
                  <datalist id="job-role-options">
                    {jobRoles.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.name} />)}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">Role-set metrics and goals attach to the role. <a href="/admin/roles" className="text-visory-link underline">Manage roles</a></p>
                </div>
                <Input
                  label="Team"
                  value={newInvite.team}
                  onChange={(e) => setNewInvite((u) => ({ ...u, team: e.target.value }))}
                  placeholder="e.g. Engineering"
                />
                <div>
                  <label className="block text-sm font-medium text-visory-navy mb-1">Role</label>
                  <select
                    value={newInvite.role}
                    onChange={(e) => setNewInvite((u) => ({ ...u, role: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{getRoleDisplayName(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-visory-navy mb-1">Manager</label>
                  <select
                    value={newInvite.managerId}
                    onChange={(e) => setNewInvite((u) => ({ ...u, managerId: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory"
                  >
                    <option value="">No Manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Invitation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {showImport && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Bulk Import Users</h2>
            <p className="text-xs text-gray-500">Upload a CSV file to create multiple invitations at once</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-600 mb-1">Expected columns (with or without header row)</p>
              <p className="text-xs text-gray-500 mb-2">Column order: <code className="bg-gray-200 px-1 rounded">name</code>, <code className="bg-gray-200 px-1 rounded">email</code>, <code className="bg-gray-200 px-1 rounded">role</code>, <code className="bg-gray-200 px-1 rounded">jobTitle</code>, <code className="bg-gray-200 px-1 rounded">team</code>, <code className="bg-gray-200 px-1 rounded">managerEmail</code></p>
              <p className="text-xs text-gray-500">Accepts CSV files or tab-separated data pasted from a spreadsheet.</p>
            </div>
            <form onSubmit={handleCsvImport} className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                required
                className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-visory file:text-white hover:file:opacity-90 file:cursor-pointer"
              />
              <Button type="submit" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </form>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Or paste from spreadsheet</p>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder={"Paste rows here (tab-separated from Excel/Sheets)\ne.g. Jane Smith\tjane@company.com\tEMPLOYEE\tAccountant\tTeam 1\tmanager@company.com"}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:ring-visory focus:border-visory"
              />
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={importing || !pasteData.trim()}
                onClick={handlePasteImport}
              >
                {importing ? "Importing..." : "Import Pasted Data"}
              </Button>
            </div>
            {importResult && (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-visory">{importResult.invited}</p>
                    <p className="text-xs text-gray-500">Invited</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{importResult.emailsSent}</p>
                    <p className="text-xs text-gray-500">Emails Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-400">{importResult.skipped}</p>
                    <p className="text-xs text-gray-500">Skipped</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-visory-navy">{importResult.total}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                </div>
                {importResult.results.some((r) => r.status !== "invited") && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Skipped rows:</p>
                    <div className="space-y-1">
                      {importResult.results.filter((r) => r.status !== "invited").map((r, i) => (
                        <p key={i} className="text-xs text-gray-500">
                          {r.email} — {r.status === "skipped_existing_user" ? "already registered" : "invitation already pending"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Pending Invitations</h2>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-visory-navy">{inv.name}</p>
                    <p className="text-xs text-gray-500">{inv.email}</p>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs mt-1">
                      {getRoleDisplayName(inv.role)}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resendEmail(inv.id)}
                      disabled={resendingEmail === inv.id}
                    >
                      {resendingEmail === "sent-" + inv.id ? "Sent!" : resendingEmail === inv.id ? "Sending..." : "Send Email"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyInviteLink(inv.token)}
                    >
                      {copiedToken === inv.token ? "Copied!" : "Copy Link"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Users */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Active Users</h2>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-visory-navy">{user.name}</p>
                    {!user.isActive && (
                      <Badge className="bg-red-100 text-red-800 border-red-300">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {user.jobTitle && (
                      <span className="text-xs text-gray-500">{user.jobTitle}</span>
                    )}
                    {user.jobTitle && user.team && <span className="text-xs text-gray-400">&middot;</span>}
                    {user.team && (
                      <span className="text-xs text-gray-500">{user.team}</span>
                    )}
                  </div>
                  {user.manager && (
                    <p className="text-xs text-gray-400">Reports to: {user.manager.name}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={user.jobRoleId || ""}
                    onChange={(e) => updateUser(user.id, { jobRoleId: e.target.value || null })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-visory"
                    title="Job role"
                  >
                    <option value="">No role</option>
                    {jobRoles.filter((r) => r.isActive || r.id === user.jobRoleId).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <input
                    defaultValue={user.team || ""}
                    onBlur={(e) => { if (e.target.value !== (user.team || "")) updateUser(user.id, { team: e.target.value }); }}
                    placeholder="Team"
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-visory"
                  />
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.id, { role: e.target.value })}
                    disabled={user.id === session?.user?.id}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-visory"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{getRoleDisplayName(r)}</option>
                    ))}
                  </select>
                  <select
                    value={user.managerId || ""}
                    onChange={(e) => updateUser(user.id, { managerId: e.target.value || null })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-visory"
                  >
                    <option value="">No Manager</option>
                    {managers.filter((m) => m.id !== user.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant={user.isActive ? "danger" : "secondary"}
                    onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                    disabled={user.id === session?.user?.id}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  {user.id !== session?.user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteId(user.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                {confirmDeleteId === user.id && (
                  <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-700">
                      Permanently delete <strong>{user.name}</strong> and all their assessment history?
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="danger" onClick={() => deleteUser(user.id)} disabled={deleting}>
                        {deleting ? "Deleting..." : "Confirm Delete"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
