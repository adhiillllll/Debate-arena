
"use client";

import { useMemo, useState } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";

type Debate = {
    id: number;
    title: string;
    description: string;
    category: string;
    participants: number;
    status: "Live" | "Upcoming" | "Completed";
    format: "1 vs 1" | "Team vs Team";
};

const debates: Debate[] = [
    {
        id: 1,
        title: "Is AI beneficial for society?",
        description:
            "Explore how artificial intelligence impacts society, work, and everyday life.",
        category: "Technology",
        participants: 12,
        status: "Live",
        format: "1 vs 1",
    },
    {
        id: 2,
        title: "Should college education be free?",
        description:
            "Discuss access to higher education and its impact on the economy.",
        category: "Education",
        participants: 8,
        status: "Upcoming",
        format: "Team vs Team",
    },
    {
        id: 3,
        title: "Can social media improve democracy?",
        description:
            "Debate the role of social platforms in public discussion and democracy.",
        category: "Society",
        participants: 16,
        status: "Live",
        format: "1 vs 1",
    },
    {
        id: 4,
        title: "Is renewable energy enough to solve climate change?",
        description:
            "Consider renewable energy, climate policy, and environmental responsibility.",
        category: "Environment",
        participants: 10,
        status: "Upcoming",
        format: "Team vs Team",
    },
    {
        id: 5,
        title: "Should governments regulate AI?",
        description:
            "Examine innovation, public safety, and the need for AI regulation.",
        category: "Technology",
        participants: 14,
        status: "Completed",
        format: "1 vs 1",
    },
    {
        id: 6,
        title: "Does competition improve education?",
        description:
            "Discuss whether competition helps students learn and perform better.",
        category: "Education",
        participants: 6,
        status: "Live",
        format: "Team vs Team",
    },
];

const categories = [
    "All Categories",
    "Technology",
    "Education",
    "Politics",
    "Science",
    "Society",
    "Environment",
    "Economics",
    "Health",
    "Other",
];

const statuses = ["All Statuses", "Live", "Upcoming", "Completed"];

export default function DiscoverDebatesPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All Categories");
    const [status, setStatus] = useState("All Statuses");
    const [selectedDebate, setSelectedDebate] = useState("");

    const filteredDebates = useMemo(() => {
        return debates.filter((debate) => {
            const matchesSearch =
                debate.title.toLowerCase().includes(search.toLowerCase()) ||
                debate.description.toLowerCase().includes(search.toLowerCase());

            const matchesCategory =
                category === "All Categories" || debate.category === category;

            const matchesStatus =
                status === "All Statuses" || debate.status === status;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [search, category, status]);

    return (
        <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC] dark:[color-scheme:dark]">
            <DashboardSidebar />

            <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <header className="mb-8">
                        <p className="text-sm font-medium text-[#B58A42] dark:text-[#D9AD60]">
                            COMMUNITY ARENA
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Discover Debates
                        </h1>

                        <p className="mt-2 text-slate-500 dark:text-slate-300">
                            Explore ideas, challenge perspectives, and join meaningful discussions.
                        </p>
                    </header>

                    {/* Search and Filters */}
                    <section className="mb-8 rounded-2xl border border-[#E5DFD2] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
                            <div>
                                <label
                                    htmlFor="debate-search"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Search debates
                                </label>

                                <input
                                    id="debate-search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search by topic or keyword..."
                                    className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60] dark:border-[#52637C] dark:bg-[#172940]"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="category-filter"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Category
                                </label>

                                <select
                                    id="category-filter"
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value)}
                                    className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60] dark:border-[#52637C] dark:bg-[#172940]"
                                >
                                    {categories.map((item) => (
                                        <option key={item}>{item}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="status-filter"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Status
                                </label>

                                <select
                                    id="status-filter"
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value)}
                                    className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60] dark:border-[#52637C] dark:bg-[#172940]"
                                >
                                    {statuses.map((item) => (
                                        <option key={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-[#E5DFD2] pt-4 dark:border-[#3B4C63]">
                            <p className="text-sm text-slate-500 dark:text-slate-300">
                                Showing{" "}
                                <span className="font-semibold text-[#192F50] dark:text-[#F8F5EC]">
                                    {filteredDebates.length}
                                </span>{" "}
                                debates
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setCategory("All Categories");
                                    setStatus("All Statuses");
                                    setSelectedDebate("");
                                }}
                                className="text-sm font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
                            >
                                Reset filters
                            </button>
                        </div>
                    </section>

                    {/* Debate Cards */}
                    {filteredDebates.length > 0 ? (
                        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                            {filteredDebates.map((debate) => (
                                <article
                                    key={debate.id}
                                    className="flex flex-col rounded-2xl border border-[#E5DFD2] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]"
                                >
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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

                                    <h2 className="text-lg font-bold text-[#192F50] dark:text-[#F8F5EC]">
                                        {debate.title}
                                    </h2>

                                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-300">
                                        {debate.description}
                                    </p>

                                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E5DFD2] pt-4 text-xs text-slate-500 dark:border-[#3B4C63] dark:text-slate-300">
                                        <span>{debate.participants} participants</span>
                                        <span>•</span>
                                        <span>{debate.format}</span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedDebate(
                                                `${debate.title}: debate details and joining will be enabled when the backend is connected.`
                                            )
                                        }
                                        className="mt-4 w-full rounded-xl bg-[#192F50] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#304765]"
                                    >
                                        {debate.status === "Live"
                                            ? "View Live Debate →"
                                            : debate.status === "Upcoming"
                                                ? "View Debate →"
                                                : "View Results →"}
                                    </button>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <section className="rounded-2xl border border-[#E5DFD2] bg-white px-6 py-16 text-center dark:border-[#3B4C63] dark:bg-[#20334E]">
                            <h2 className="text-xl font-bold">No debates found</h2>

                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                                Try changing your search or filters.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setCategory("All Categories");
                                    setStatus("All Statuses");
                                }}
                                className="mt-5 rounded-xl bg-[#192F50] px-5 py-3 text-sm font-semibold text-white"
                            >
                                Clear filters
                            </button>
                        </section>
                    )}

                    {/* Temporary detail message */}
                    {selectedDebate && (
                        <div
                            role="status"
                            className="mt-6 rounded-xl border border-[#D9AD60] bg-[#F3EBDD] p-4 text-sm text-[#192F50] dark:bg-[#2B3543] dark:text-[#F8F5EC]"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <p>{selectedDebate}</p>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDebate("")}
                                    className="font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
