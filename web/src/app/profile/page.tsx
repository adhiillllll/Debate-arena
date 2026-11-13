"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard-sidebar";

const sampleProfile = {
  displayName: "Jordan Lee",
  username: "jordanlee",
  email: "jordan@example.com",
  location: "Bengaluru, India",
  bio: "Curious about technology, education, and the ideas that shape our world. Always open to a thoughtful challenge.",
  format: "1 vs 1",
};

const statistics = [
  { label: "Debates participated", value: 8 },
  { label: "Debates created", value: 2 },
  { label: "Debates won", value: 5 },
  { label: "Votes cast", value: 16 },
];

const inputClass = "w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 text-sm outline-none focus:border-[#D9AD60] dark:border-[#52637C] dark:bg-[#172940]";
const secondaryButton = "rounded-xl border border-[#D8DDE5] px-5 py-3 text-sm font-semibold transition hover:bg-[#F8F5EC] dark:border-[#52637C] dark:hover:bg-[#304765]";

export default function ProfilePage() {
  const [profile, setProfile] = useState(sampleProfile);
  const [draft, setDraft] = useState(sampleProfile);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState({ invitations: true, reminders: false });
  const nameInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfile({ ...draft, displayName: draft.displayName.trim(), username: draft.username.trim() });
    setEditing(false);
    setMessage("Profile preview updated. Changes are kept on this page only and reset when you leave or refresh.");
    editButton.current?.focus();
  }

  const initials = profile.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC] dark:[color-scheme:dark]">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header>
            <p className="text-sm font-medium text-[#B58A42] dark:text-[#D9AD60]">YOUR DEBATE IDENTITY</p>
            <h1 className="mt-2 text-3xl font-bold">Profile</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-300">Your introduction to the arena, interests, and debate activity.</p>
          </header>

          <p className="rounded-xl border border-[#E5DFD2] bg-white px-4 py-3 text-sm text-slate-600 dark:border-[#3B4C63] dark:bg-[#20334E] dark:text-slate-300">
            <span className="font-semibold text-[#9B7435] dark:text-[#D9AD60]">Demo profile.</span>{" "}
            All information and statistics below are sample data. Edits and preferences preview locally; they do not update your account.
          </p>

          <section aria-label="Profile summary" className="rounded-2xl border border-[#E5DFD2] bg-white p-5 sm:p-6 dark:border-[#3B4C63] dark:bg-[#20334E]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div aria-label={`Avatar placeholder for ${profile.displayName}`} role="img" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#192F50] text-2xl font-bold text-[#D9AD60]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">@{profile.username}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{profile.email}</p>
              </div>
              <button
                ref={editButton}
                type="button"
                aria-controls="profile-details"
                onClick={() => {
                  setDraft(profile);
                  setEditing(true);
                  setMessage("");
                  nameInput.current?.focus();
                }}
                className="shrink-0 rounded-xl bg-[#192F50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#304765]"
              >
                Edit Profile
              </button>
            </div>
          </section>

          <section aria-label="Sample debate statistics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {statistics.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[#E5DFD2] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
                <p className="text-sm text-slate-500 dark:text-slate-300">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">{stat.value}</p>
                <p className="mt-2 text-xs text-[#9B7435] dark:text-[#D9AD60]">Sample activity</p>
              </div>
            ))}
          </section>

          <p role="status" className="text-sm text-[#5F7664] empty:hidden dark:text-[#9DC7BC]">{message}</p>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section id="profile-details" aria-labelledby="profile-details-heading" className="min-w-0 rounded-2xl border border-[#E5DFD2] bg-white p-5 sm:p-6 dark:border-[#3B4C63] dark:bg-[#20334E]">
              <h2 id="profile-details-heading" className="text-xl font-bold">Basic information</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Share a little about yourself and the conversations you enjoy.</p>

              <form onSubmit={saveProfile} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold">Display name</label>
                    <input ref={nameInput} id="profile-name" autoComplete="off" value={editing ? draft.displayName : profile.displayName} readOnly={!editing} required pattern=".*\S.*" maxLength={60} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="profile-username" className="mb-2 block text-sm font-semibold">Username</label>
                    <input id="profile-username" autoComplete="off" value={editing ? draft.username : profile.username} readOnly={!editing} required pattern="[A-Za-z0-9_]{3,30}" title="Use 3–30 letters, numbers, or underscores." onChange={(event) => setDraft({ ...draft, username: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold">Email</label>
                    <input id="profile-email" type="email" value={profile.email} readOnly aria-describedby="profile-email-note" className={`${inputClass} text-slate-500 dark:text-slate-300`} />
                    <p id="profile-email-note" className="mt-2 text-xs text-slate-500 dark:text-slate-300">Sample email. Account email changes are unavailable in this preview.</p>
                  </div>
                  <div>
                    <label htmlFor="profile-location" className="mb-2 block text-sm font-semibold">Location</label>
                    <input id="profile-location" autoComplete="off" value={editing ? draft.location : profile.location} readOnly={!editing} maxLength={80} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="profile-bio" className="mb-2 block text-sm font-semibold">About you</label>
                  <textarea id="profile-bio" value={editing ? draft.bio : profile.bio} readOnly={!editing} maxLength={300} rows={4} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className={`${inputClass} resize-y`} />
                </div>
                <div>
                  <label htmlFor="profile-format" className="mb-2 block text-sm font-semibold">Preferred debate format</label>
                  {editing ? (
                    <select id="profile-format" value={draft.format} onChange={(event) => setDraft({ ...draft, format: event.target.value })} className={inputClass}>
                      <option>1 vs 1</option>
                      <option>Team vs Team</option>
                    </select>
                  ) : (
                    <input id="profile-format" readOnly value={profile.format} className={inputClass} />
                  )}
                </div>
                {editing && (
                  <div className="flex flex-wrap justify-end gap-3 border-t border-[#E5DFD2] pt-5 dark:border-[#3B4C63]">
                    <button type="button" onClick={() => { setDraft(profile); setEditing(false); editButton.current?.focus(); }} className={secondaryButton}>Cancel</button>
                    <button type="submit" className="rounded-xl bg-[#192F50] px-5 py-3 text-sm font-semibold text-white hover:bg-[#304765]">Save preview</button>
                  </div>
                )}
              </form>
            </section>

            <div className="min-w-0 space-y-6">
              <section aria-labelledby="account-settings-heading" className="rounded-2xl border border-[#E5DFD2] bg-white p-5 sm:p-6 dark:border-[#3B4C63] dark:bg-[#20334E]">
                <h2 id="account-settings-heading" className="text-xl font-bold">Account preferences</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">Preview notification preferences. These switches do not change delivery settings.</p>
                <div className="mt-5 divide-y divide-[#E5DFD2] dark:divide-[#3B4C63]">
                  {([
                    { key: "invitations", title: "Debate invitations", description: "Invitations from other debaters." },
                    { key: "reminders", title: "Upcoming debates", description: "Reminders before scheduled debates." },
                  ] as const).map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <p id={`${item.key}-label`} className="text-sm font-semibold">{item.title}</p>
                        <p id={`${item.key}-description`} className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences[item.key]}
                        aria-labelledby={`${item.key}-label`}
                        aria-describedby={`${item.key}-description`}
                        onClick={() => {
                          setPreferences((current) => ({ ...current, [item.key]: !current[item.key] }));
                          setMessage("Preference preview updated for this page only. Your account settings have not changed.");
                        }}
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${preferences[item.key] ? "bg-[#192F50]" : "bg-slate-300"}`}
                      >
                        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white transition-transform ${preferences[item.key] ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-[#E5DFD2] bg-[#F3EBDD] p-5 sm:p-6 dark:border-[#3B4C63] dark:bg-[#2B3543]">
                <h2 className="font-bold">Keep the conversation going</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Find your next topic or revisit the debates you have taken part in.</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
                  <Link href="/debates/discover" className="hover:underline">Discover debates →</Link>
                  <Link href="/debates" className="hover:underline">My debates →</Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
