
"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard-sidebar";

type Debate = {
    id: number;
    title: string;
    category: string;
    status: "Live" | "Upcoming" | "Completed";
    role: string;
    date: string;
    participants: number;
};

const debateGroups: Record<string, Debate[]> = {
    Created: [
        {
            id: 1,
            title: "Should AI replace traditional education?",
            category: "Technology",
            status: "Upcoming",
            role: "Moderator",
            date: "Nov 12, 2026",
            participants: 8,
        },
        {
            id: 2,
            title: "Is social media doing more harm than good?",
            category: "Society",
            status: "Live",
            role: "Moderator",
            date: "Nov 10, 2026",
            participants: 12,
        },
    ],
    Participated: [
        {
            id: 3,
            title: "Should college education be free?",
            category: "Education",
            status: "Completed",
            role: "Debater A",
            date: "Nov 5, 2026",
            participants: 10,
        },
    ],
    Voted: [
        {
            id: 4,
            title: "Can renewable energy replace fossil fuels?",
            category: "Environment",
            status: "Completed",
            role: "Audience",
            date: "Nov 2, 2026",
            participants: 16,
        },
    ],
};

const tabs = ["Created", "Participated", "Voted"];

export default function MyDebatesPage() {
    const [activeTab, setActiveTab] = useState("Created");

    const currentDebates = debateGroups[activeTab];

    return (
        <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC] dark:[color-scheme:dark]">
            <DashboardSidebar />

            <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <header className="mb-8">
                        <p className="text-sm font-medium text-[#B58A42] dark:text-[#D9AD60]">
                            YOUR ACTIVITY
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">My Debates</h1>

                        <p className="mt-2 text-slate-500 dark:text-slate-300">
                            Manage your debates and track your participation.
                        </p>
                    </header>

                    {/* Summary cards */}
                    <section className="mb-8 grid gap-4 sm:grid-cols-3">
                        {[
                            {
                                label: "Created",
                                count: debateGroups.Created.length,
                                icon: "+",
                            },
                            {
                                label: "Participated",
                                count: debateGroups.Participated.length,
                                icon: "◉",
                            },
                            {
                                label: "Voted",
                                count: debateGroups.Voted.length,
                                icon: "✓",
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-2xl border border-[#E5DFD2] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-500 dark:text-slate-300">{item.label}</p>

                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3EBDD] font-bold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                                        {item.icon}
                                    </span>
                                </div>

                                <p className="mt-3 text-3xl font-bold">{item.count}</p>
                            </div>
                        ))}
                    </section>

                    {/* Tabs */}
                    <section className="rounded-2xl border border-[#E5DFD2] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
                        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#E5DFD2] pb-4 dark:border-[#3B4C63]">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    aria-pressed={activeTab === tab}
                                    className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${activeTab === tab
                                            ? "bg-[#192F50] text-white"
                                            : "bg-[#F8F5EC] text-slate-500 hover:bg-[#EDE7DA] dark:bg-[#101D30] dark:text-slate-300 dark:hover:bg-[#304765]"
                                        }`}
                                >
                                    {tab}
                                    <span className="ml-2 opacity-70">
                                        {debateGroups[tab].length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Debate list */}
                        {currentDebates.length > 0 ? (
                            <div className="space-y-4">
                                {currentDebates.map((debate) => (
                                    <article
                                        key={debate.id}
                                        className="rounded-xl border border-[#E5DFD2] p-5 transition hover:shadow-sm dark:border-[#3B4C63]"
                                    >
                                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                                            <div className="min-w-0">
                                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-medium text-[#9B7435] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                                                        {debate.category}
                                                    </span>

                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-medium ${debate.status === "Live"
                                                                ? "bg-[#E8EFED] text-[#5F9186] dark:bg-[#243F40] dark:text-[#9DC7BC]"
                                                                : debate.status === "Upcoming"
                                                                    ? "bg-slate-100 text-slate-500 dark:bg-[#2B405C] dark:text-slate-300"
                                                                    : "bg-[#EDE8F5] text-[#79649A] dark:bg-[#38324B] dark:text-[#C7B4E3]"
                                                            }`}
                                                    >
                                                        {debate.status}
                                                    </span>
                                                </div>

                                                <h2 className="text-lg font-bold">
                                                    {debate.title}
                                                </h2>

                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-300">
                                                    <span>Role: {debate.role}</span>
                                                    <span>{debate.date}</span>
                                                    <span>{debate.participants} participants</span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    alert(
                                                        "Debate details will be available after backend integration."
                                                    )
                                                }
                                                className="shrink-0 rounded-xl border border-[#D8DDE5] px-5 py-3 text-sm font-semibold transition hover:bg-[#F8F5EC] dark:border-[#52637C] dark:hover:bg-[#304765]"
                                            >
                                                View Details →
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 text-center">
                                <h2 className="text-lg font-bold">No debates yet</h2>

                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                                    Your activity will appear here when you start participating.
                                </p>

                                <Link
                                    href="/debates/discover"
                                    className="mt-5 inline-block rounded-xl bg-[#192F50] px-5 py-3 text-sm font-semibold text-white"
                                >
                                    Discover Debates →
                                </Link>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
