"use client";

import { useState } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";

type Invitation = {
    id: number;
    debateTitle: string;
    from: string;
    category: string;
    format: string;
    date: string;
    status: "pending" | "accepted" | "declined";
};

const initialInvitations: Invitation[] = [
    {
        id: 1,
        debateTitle: "Is AI a threat to humanity?",
        from: "Alex Morgan",
        category: "Technology",
        format: "1 vs 1",
        date: "Nov 12, 2026",
        status: "pending",
    },
    {
        id: 2,
        debateTitle: "Should social media be regulated?",
        from: "Sarah Wilson",
        category: "Society",
        format: "1 vs 1",
        date: "Nov 14, 2026",
        status: "pending",
    },
    {
        id: 3,
        debateTitle: "Is remote work better than office work?",
        from: "David Thomas",
        category: "Work & Career",
        format: "Team vs Team",
        date: "Nov 16, 2026",
        status: "accepted",
    },
];

export default function InvitationsPage() {
    const [invitations, setInvitations] = useState(initialInvitations);
    const [activeTab, setActiveTab] = useState<
        "all" | "pending" | "accepted" | "declined"
    >("all");

    const updateInvitation = (
        id: number,
        status: "accepted" | "declined"
    ) => {
        setInvitations((current) =>
            current.map((invitation) =>
                invitation.id === id
                    ? { ...invitation, status }
                    : invitation
            )
        );
    };

    const filteredInvitations = invitations.filter((invitation) => {
        if (activeTab === "all") return true;
        return invitation.status === activeTab;
    });

    const pendingCount = invitations.filter(
        (invitation) => invitation.status === "pending"
    ).length;

    return (
        <div className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC] dark:[color-scheme:dark]">
            <DashboardSidebar />

            <main className="min-w-0 flex-1">
                <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <p className="text-sm font-medium text-[#9A7B43] dark:text-[#D9AD60]">
                            SOCIAL
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Invitations
                        </h1>

                        <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                            Manage debate invitations from your friends.
                        </p>
                    </div>

                    {/* Summary */}
                    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
                            <p className="text-sm text-gray-500 dark:text-slate-300">
                                Total Invitations
                            </p>
                            <p className="mt-2 text-3xl font-bold">
                                {invitations.length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
                            <p className="text-sm text-gray-500 dark:text-slate-300">
                                Pending Invitations
                            </p>
                            <p className="mt-2 text-3xl font-bold">
                                {pendingCount}
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mb-6 flex flex-wrap gap-2">
                        {(["all", "pending", "accepted", "declined"] as const).map(
                            (tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    aria-pressed={activeTab === tab}
                                    className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${activeTab === tab
                                            ? "bg-[#192F50] text-white"
                                            : "border border-[#E7DFCF] bg-white hover:bg-gray-50 dark:border-[#3B4C63] dark:bg-[#20334E] dark:hover:bg-[#304765]"
                                        }`}
                                >
                                    {tab === "all" ? "All Invitations" : tab}
                                </button>
                            )
                        )}
                    </div>

                    {/* Invitation cards */}
                    {filteredInvitations.length === 0 ? (
                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-10 text-center dark:border-[#3B4C63] dark:bg-[#20334E]">
                            <h2 className="font-semibold">
                                No {activeTab === "all" ? "" : activeTab} invitations
                            </h2>

                            <p className="mt-2 text-sm text-gray-500 dark:text-slate-300">
                                Invitations will appear here when someone invites you.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredInvitations.map((invitation) => (
                                <div
                                    key={invitation.id}
                                    className="rounded-2xl border border-[#E7DFCF] bg-white p-5 md:p-6 dark:border-[#3B4C63] dark:bg-[#20334E]"
                                >
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-[#F2E8D4] px-3 py-1 text-xs font-medium text-[#9A7B43] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                                                    {invitation.category}
                                                </span>

                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-[#2B405C] dark:text-slate-300">
                                                    {invitation.format}
                                                </span>

                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${invitation.status === "pending"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : invitation.status === "accepted"
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-red-100 text-red-700"
                                                        }`}
                                                >
                                                    {invitation.status}
                                                </span>
                                            </div>

                                            <h2 className="text-lg font-bold">
                                                {invitation.debateTitle}
                                            </h2>

                                            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                                                Invited by{" "}
                                                <span className="font-semibold text-[#192F50] dark:text-[#F8F5EC]">
                                                    {invitation.from}
                                                </span>
                                            </p>

                                            <p className="mt-1 text-sm text-gray-500 dark:text-slate-300">
                                                Scheduled: {invitation.date}
                                            </p>
                                        </div>

                                        {invitation.status === "pending" ? (
                                            <div className="flex shrink-0 flex-wrap gap-3">
                                                <button
                                                    onClick={() =>
                                                        updateInvitation(invitation.id, "accepted")
                                                    }
                                                    className="rounded-xl bg-[#D9AD60] px-5 py-2.5 text-sm font-semibold text-[#192F50] transition hover:bg-[#C99A4C]"
                                                >
                                                    Accept
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        updateInvitation(invitation.id, "declined")
                                                    }
                                                    className="rounded-xl border border-[#E7DFCF] px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-[#3B4C63] dark:text-slate-300 dark:hover:bg-[#304765]"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium capitalize text-gray-500 dark:text-slate-300">
                                                {invitation.status}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="mt-6 text-xs text-gray-400 dark:text-slate-400">
                        Demo data only. Invitation actions are not connected to the backend yet.
                    </p>
                </div>
            </main>
        </div>
    );
}