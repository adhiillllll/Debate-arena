
"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default function CreateDebatePage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("Technology");
    const [format, setFormat] = useState("1 vs 1");
    const [visibility, setVisibility] = useState("Public");
    const [duration, setDuration] = useState("30 minutes");
    const [message, setMessage] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setMessage(
            "Your form is ready. Debate creation will be enabled after backend integration."
        );
    }

    return (
        <main className="flex min-h-screen bg-[#F8F5EC] text-[#192F50]">
            <DashboardSidebar />

            <div className="min-w-0 flex-1 p-8">
                <div className="mx-auto max-w-4xl">
                    <Link
                        href="/"
                        className="mb-6 inline-block text-sm font-semibold text-[#B58A42] hover:underline"
                    >
                        ← Back to Dashboard
                    </Link>

                    <header className="mb-8">
                        <p className="text-sm font-medium text-[#B58A42]">
                            START A DISCUSSION
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Create a Debate
                        </h1>

                        <p className="mt-2 text-slate-500">
                            Set the topic, choose the format, and invite others to challenge your ideas.
                        </p>
                    </header>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6 rounded-2xl border border-[#E5DFD2] bg-white p-7 shadow-sm"
                    >
                        {/* Debate Topic */}
                        <section>
                            <label
                                htmlFor="title"
                                className="mb-2 block text-sm font-semibold"
                            >
                                Debate Topic
                            </label>

                            <input
                                id="title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                required
                                maxLength={150}
                                placeholder="e.g. Is artificial intelligence beneficial for society?"
                                className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60]"
                            />

                            <p className="mt-1 text-xs text-slate-400">
                                Keep your topic clear and debatable.
                            </p>
                        </section>

                        {/* Description */}
                        <section>
                            <label
                                htmlFor="description"
                                className="mb-2 block text-sm font-semibold"
                            >
                                Description / Debate Question
                            </label>

                            <textarea
                                id="description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                required
                                maxLength={1000}
                                rows={4}
                                placeholder="Explain the context and what participants will debate..."
                                className="w-full resize-y rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60]"
                            />
                        </section>

                        {/* Category */}
                        <section>
                            <label
                                htmlFor="category"
                                className="mb-2 block text-sm font-semibold"
                            >
                                Category
                            </label>

                            <select
                                id="category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60]"
                            >
                                <option>Technology</option>
                                <option>Education</option>
                                <option>Politics</option>
                                <option>Science</option>
                                <option>Society</option>
                                <option>Environment</option>
                                <option>Economics</option>
                                <option>Health</option>
                                <option>Other</option>
                            </select>
                        </section>

                        {/* Format */}
                        <section>
                            <label className="mb-2 block text-sm font-semibold">
                                Debate Format
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {["1 vs 1", "Team vs Team"].map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setFormat(item)}
                                        className={`rounded-xl border p-4 text-left transition ${format === item
                                            ? "border-[#D9AD60] bg-[#F3EBDD] font-semibold"
                                            : "border-[#E5DFD2] hover:border-[#D9AD60]"
                                            }`}
                                    >
                                        <span className="block">{item}</span>
                                        <span className="mt-1 block text-xs text-slate-500">
                                            {item === "1 vs 1"
                                                ? "Two participants, opposing sides"
                                                : "Two teams debating against each other"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Visibility and Duration */}
                        <div className="grid gap-5 sm:grid-cols-2">
                            <section>
                                <label
                                    htmlFor="visibility"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Debate Visibility
                                </label>

                                <select
                                    id="visibility"
                                    value={visibility}
                                    onChange={(event) => setVisibility(event.target.value)}
                                    className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60]"
                                >
                                    <option>Public</option>
                                    <option>Private</option>
                                </select>

                                <p className="mt-1 text-xs text-slate-400">
                                    Public debates can be discovered by the community.
                                </p>
                            </section>

                            <section>
                                <label
                                    htmlFor="duration"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Duration
                                </label>

                                <select
                                    id="duration"
                                    value={duration}
                                    onChange={(event) => setDuration(event.target.value)}
                                    className="w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 outline-none focus:border-[#D9AD60]"
                                >
                                    <option>15 minutes</option>
                                    <option>30 minutes</option>
                                    <option>45 minutes</option>
                                    <option>60 minutes</option>
                                </select>
                            </section>
                        </div>

                        {/* Moderator Information */}
                        <div className="rounded-xl bg-[#F3EBDD] p-4">
                            <p className="font-semibold text-[#192F50]">
                                You will be the moderator
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                                As the debate creator, you can manage the debate, invite participants,
                                and control its flow.
                            </p>
                        </div>

                        {message && (
                            <div
                                role="status"
                                className="rounded-xl border border-[#D9AD60] bg-[#F3EBDD] p-4 text-sm text-[#192F50]"
                            >
                                {message}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap justify-end gap-3 border-t border-[#E5DFD2] pt-5">
                            <Link
                                href="/"
                                className="rounded-xl border border-[#D8DDE5] px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                            >
                                Cancel
                            </Link>

                            <button
                                type="submit"
                                className="rounded-xl bg-[#192F50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#304765]"
                            >
                                Create Debate →
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
