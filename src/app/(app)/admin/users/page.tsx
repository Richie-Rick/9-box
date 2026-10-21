"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { PageHeader } from "@/components/ui/page-header";
import { getRoleDisplayName } from "@/lib/utils";

interface UserData {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  team: string | null;
  role: string;
  isActive: boolean;
  managerId: string | null;
  startDate: string | null;
  jobRoleId?: string | null;
  manager: { id: string; name: string } | null;
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

const SELECT_CLASS =
  "block w-full rounded-lg border border-line-2 bg-paper-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20";
const SELECT_SM_CLASS =
  "rounded-lg border border-line-2 bg-paper-2 px-2 py-1 text-xs text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20";
const INPUT_SM_CLASS =
  "rounded-lg border border-line-2 bg-paper-2 px-2 py-1 text-xs text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20";

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  // List filters live in the URL so a filtered view can be bookmarked or shared.
  const searchParams = useSearchParams();
  const filters = {
    q: searchParams.get("q") ?? "",
    role: searchParams.get("role") ?? "",
    team: searchParams.get("team") ?? "",
    manager: searchParams.get("manager") ?? "",
    status: searchParams.get("status") ?? "",
    sort: searchParams.get("sort") ?? "name",
  };
  function setFilter(key: keyof typeof filters, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/admin/users${params.size ? `?${params}` : ""}`, { scroll: false });
  }
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
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSetFor, setPasswordSetFor] = useState<string | null>(null);

  async function setUserPassword(userId: string) {
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setPasswordUserId(null);
        setNewPassword("");
        setPasswordSetFor(userId);
        setTimeout(() => setPasswordSetFor(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordError(data.error || "Failed to set password");
      }
    } catch {
      setPasswordError("Network error while setting password");
    } finally {
      setSavingPassword(false);
    }
  }

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    loadUsers();
    loadInvitations();
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
  const teamOptions = [...new Set(users.map((u) => u.team).filter(Boolean) as string[])].sort();
  // Job titles double as job roles (managed under Admin → Roles & Templates).
  const titleOptions = [...new Set(users.map((u) => u.jobTitle).filter(Boolean) as string[])].sort();

  const q = filters.q.trim().toLowerCase();
  const visibleUsers = users
    .filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (filters.role && u.role !== filters.role) return false;
      if (filters.team && (u.team ?? "") !== filters.team) return false;
      if (filters.manager && (u.managerId ?? "") !== filters.manager) return false;
      if (filters.status === "active" && !u.isActive) return false;
      if (filters.status === "inactive" && u.isActive) return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "role") return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
      if (filters.sort === "team") return (a.team ?? "").localeCompare(b.team ?? "") || a.name.localeCompare(b.name);
      if (filters.sort === "manager") return (a.manager?.name ?? "").localeCompare(b.manager?.name ?? "") || a.name.localeCompare(b.name);
      if (filters.sort === "start") return (a.startDate ?? "").localeCompare(b.startDate ?? "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  const hasFilters = !!(filters.q || filters.role || filters.team || filters.manager || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>User <em>management.</em></>}
        sub="Invite users and manage roles."
        actions={
          <>
            <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join`); setCopiedJoinLink(true); setTimeout(() => setCopiedJoinLink(false), 2000); }}>
              {copiedJoinLink ? "Copied!" : "Copy Join Link"}
            </Button>
            <Button variant="secondary" onClick={() => { setShowImport(!showImport); setShowInviteForm(false); }}>
              {showImport ? "Cancel" : "Bulk Import"}
            </Button>
            <Button onClick={() => { setShowInviteForm(!showInviteForm); setShowImport(false); }}>
              {showInviteForm ? "Cancel" : "Invite User"}
            </Button>
          </>
        }
      />

      {showInviteForm && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Invite new <em>user.</em></CardTitle>
              <p className="text-xs text-ink-3 mt-1">They will receive a link to set their own password</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-magenta-3 border border-magenta/25 p-3 text-sm text-magenta-2">{error}</div>
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
                <Input
                  label="Job Title (role)"
                  list="job-role-options"
                  value={newInvite.jobTitle}
                  onChange={(e) => setNewInvite((u) => ({ ...u, jobTitle: e.target.value }))}
                  placeholder="e.g. Senior Developer"
                />
                <Input
                  label="Team"
                  value={newInvite.team}
                  onChange={(e) => setNewInvite((u) => ({ ...u, team: e.target.value }))}
                  placeholder="e.g. Engineering"
                />
                <div>
                  <label className="eyebrow block mb-1.5">Role</label>
                  <select
                    value={newInvite.role}
                    onChange={(e) => setNewInvite((u) => ({ ...u, role: e.target.value }))}
                    className={SELECT_CLASS}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{getRoleDisplayName(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Manager</label>
                  <select
                    value={newInvite.managerId}
                    onChange={(e) => setNewInvite((u) => ({ ...u, managerId: e.target.value }))}
                    className={SELECT_CLASS}
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
            <div>
              <CardTitle>Bulk import <em>users.</em></CardTitle>
              <p className="text-xs text-ink-3 mt-1">Upload a CSV file to create multiple invitations at once</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-paper-2 border border-line p-3">
              <p className="text-xs font-medium text-ink-2 mb-1">Expected columns (with or without header row)</p>
              <p className="text-xs text-ink-3 mb-2">Column order: <code className="mono bg-paper border border-line px-1 rounded">name</code>, <code className="mono bg-paper border border-line px-1 rounded">email</code>, <code className="mono bg-paper border border-line px-1 rounded">role</code>, <code className="mono bg-paper border border-line px-1 rounded">jobTitle</code>, <code className="mono bg-paper border border-line px-1 rounded">team</code>, <code className="mono bg-paper border border-line px-1 rounded">managerEmail</code></p>
              <p className="text-xs text-ink-3">Accepts CSV files or tab-separated data pasted from a spreadsheet.</p>
            </div>
            <form onSubmit={handleCsvImport} className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                required
                className="text-sm text-ink-3 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-navy file:text-white hover:file:opacity-90 file:cursor-pointer"
              />
              <Button type="submit" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </form>
            <div className="border-t border-line pt-4">
              <p className="text-xs font-medium text-ink-2 mb-2">Or paste from spreadsheet</p>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder={"Paste rows here (tab-separated from Excel/Sheets)\ne.g. Jane Smith\tjane@company.com\tEMPLOYEE\tAccountant\tTeam 1\tmanager@company.com"}
                rows={4}
                className="w-full rounded-lg border border-line-2 bg-paper-2 px-3 py-2 text-xs mono text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20"
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
              <div className="rounded-lg border border-line p-3">
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <p className="mono tnum text-lg text-navy">{importResult.invited}</p>
                    <p className="tiny text-ink-3">Invited</p>
                  </div>
                  <div className="text-center">
                    <p className="mono tnum text-lg text-success">{importResult.emailsSent}</p>
                    <p className="tiny text-ink-3">Emails Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="mono tnum text-lg text-ink-3">{importResult.skipped}</p>
                    <p className="tiny text-ink-3">Skipped</p>
                  </div>
                  <div className="text-center">
                    <p className="mono tnum text-lg text-ink">{importResult.total}</p>
                    <p className="tiny text-ink-3">Total</p>
                  </div>
                </div>
                {importResult.results.some((r) => r.status !== "invited") && (
                  <div>
                    <p className="text-xs font-medium text-ink-3 mb-1">Skipped rows:</p>
                    <div className="space-y-1">
                      {importResult.results.filter((r) => r.status !== "invited").map((r, i) => (
                        <p key={i} className="text-xs text-ink-3">
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

      <datalist id="job-role-options">
        {titleOptions.map((t) => <option key={t} value={t} />)}
      </datalist>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Pending <em>invitations.</em></CardTitle>
          </CardHeader>
          <div
            className="dt-head grid items-center gap-3 px-5 py-2.5"
            style={{ gridTemplateColumns: "1fr auto" }}
          >
            <span>Invitee</span>
            <span className="text-right">Actions</span>
          </div>
          {pendingInvitations.map((inv) => (
            <div
              key={inv.id}
              className="dt-row grid items-center gap-3 px-5 py-3"
              style={{ gridTemplateColumns: "1fr auto" }}
            >
              <div>
                <p className="text-sm font-medium text-ink">{inv.name}</p>
                <p className="text-xs text-ink-3">{inv.email}</p>
                <Badge variant="warning" className="mt-1">
                  {getRoleDisplayName(inv.role)}
                </Badge>
              </div>
              <div className="flex gap-2 justify-end">
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
        </Card>
      )}

      {/* Existing Users */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-5 pt-5">
          <div className="flex items-center gap-2">
            <CardTitle>All <em>users.</em></CardTitle>
            <Badge variant="slate" className="mono tnum">{visibleUsers.length}{hasFilters ? ` of ${users.length}` : ""}</Badge>
          </div>
        </CardHeader>
        <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className={`${INPUT_SM_CLASS} w-48`}
          />
          <select value={filters.role} onChange={(e) => setFilter("role", e.target.value)} className={SELECT_SM_CLASS} aria-label="Filter by role">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{getRoleDisplayName(r)}</option>)}
          </select>
          <select value={filters.team} onChange={(e) => setFilter("team", e.target.value)} className={SELECT_SM_CLASS} aria-label="Filter by team">
            <option value="">All teams</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.manager} onChange={(e) => setFilter("manager", e.target.value)} className={SELECT_SM_CLASS} aria-label="Filter by manager">
            <option value="">All managers</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={SELECT_SM_CLASS} aria-label="Filter by status">
            <option value="">Active & inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)} className={SELECT_SM_CLASS} aria-label="Sort">
            <option value="name">Sort: name</option>
            <option value="role">Sort: role</option>
            <option value="team">Sort: team</option>
            <option value="manager">Sort: manager</option>
            <option value="start">Sort: start date</option>
          </select>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => router.replace("/admin/users", { scroll: false })}>
              Clear
            </Button>
          )}
        </div>
        <div
          className="dt-head grid gap-3 px-5 py-2.5"
          style={{ gridTemplateColumns: "1fr auto" }}
        >
          <span>User</span>
          <span className="text-right">Manage</span>
        </div>
        {visibleUsers.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-3">No users match these filters.</p>
        )}
        {visibleUsers.map((user) => (
          <div key={user.id} className="dt-row px-5 py-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{user.name}</p>
                  {!user.isActive && (
                    <Badge variant="magenta">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-3">{user.email}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {user.jobTitle && (
                    <span className="text-xs text-ink-3">{user.jobTitle}</span>
                  )}
                  {user.jobTitle && user.team && <span className="text-xs text-ink-4">&middot;</span>}
                  {user.team && (
                    <span className="text-xs text-ink-3">{user.team}</span>
                  )}
                </div>
                {user.manager && (
                  <p className="text-xs text-ink-4">Reports to: {user.manager.name}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  list="job-role-options"
                  defaultValue={user.jobTitle || ""}
                  onBlur={(e) => { if (e.target.value !== (user.jobTitle || "")) updateUser(user.id, { jobTitle: e.target.value }); }}
                  placeholder="Job title (role)"
                  title="Job title doubles as the job role; role-set metrics and goals follow it"
                  className={`${INPUT_SM_CLASS} w-28`}
                />
                <input
                  defaultValue={user.team || ""}
                  onBlur={(e) => { if (e.target.value !== (user.team || "")) updateUser(user.id, { team: e.target.value }); }}
                  placeholder="Team"
                  className={`${INPUT_SM_CLASS} w-24`}
                />
                <input
                  type="date"
                  title="Start date"
                  defaultValue={user.startDate ? user.startDate.slice(0, 10) : ""}
                  onBlur={(e) => { if (e.target.value !== (user.startDate ? user.startDate.slice(0, 10) : "")) updateUser(user.id, { startDate: e.target.value || null }); }}
                  className={`${INPUT_SM_CLASS} mono tnum w-32`}
                />
                <select
                  value={user.role}
                  onChange={(e) => updateUser(user.id, { role: e.target.value })}
                  disabled={user.id === session?.user?.id}
                  className={SELECT_SM_CLASS}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{getRoleDisplayName(r)}</option>
                  ))}
                </select>
                <select
                  value={user.managerId || ""}
                  onChange={(e) => updateUser(user.id, { managerId: e.target.value || null })}
                  className={SELECT_SM_CLASS}
                >
                  <option value="">No Manager</option>
                  {managers.filter((m) => m.id !== user.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5" title={user.isActive ? "Active" : "Inactive"}>
                  <Toggle
                    checked={user.isActive}
                    onChange={() => updateUser(user.id, { isActive: !user.isActive })}
                    disabled={user.id === session?.user?.id}
                    label={user.isActive ? "Deactivate user" : "Activate user"}
                  />
                  <span className="text-xs text-ink-3">{user.isActive ? "Active" : "Inactive"}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPasswordUserId(passwordUserId === user.id ? null : user.id);
                    setNewPassword("");
                    setPasswordError("");
                  }}
                >
                  Set password
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
            </div>
            {passwordSetFor === user.id && (
              <div className="mt-2 rounded-lg bg-paper-2 border border-line p-2 text-sm text-success">
                Password updated for {user.name}.
              </div>
            )}
            {passwordUserId === user.id && (
              <div className="mt-2 rounded-lg bg-paper-2 border border-line p-3 space-y-2">
                <p className="text-sm text-ink-2">
                  Set a new password for <strong className="text-ink">{user.name}</strong>. Share it securely; they can change it later.
                </p>
                {passwordError && <p className="text-sm text-magenta-2">{passwordError}</p>}
                <div className="flex gap-2">
                  <Input
                    id={`pw-${user.id}`}
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                  />
                  <Button size="sm" onClick={() => setUserPassword(user.id)} disabled={savingPassword}>
                    {savingPassword ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPasswordUserId(null); setNewPassword(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {confirmDeleteId === user.id && (
              <div className="mt-2 rounded-lg bg-magenta-3 border border-magenta/25 p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-magenta-2">
                  Permanently delete <strong>{user.name}</strong> and all their assessment history?
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="magenta" onClick={() => deleteUser(user.id)} disabled={deleting}>
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
      </Card>
    </div>
  );
}
