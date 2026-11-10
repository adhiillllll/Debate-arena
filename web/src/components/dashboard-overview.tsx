"use client";

import Link from "next/link";

const publicDebates = [
  {
    title: "Is AI beneficial for society?",
    category: "Technology",
    participants: 12,
    status: "Live",
  },
  {
    title: "Should college education be free?",
    category: "Education",
    participants: 8,
    status: "Upcoming",
  },
  {
    title: "Can social media improve democracy?",
    category: "Society",
    participants: 16,
    status: "Live",
  },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <section>
        <p className="text-sm font-medium text-[#B58A42]">
          YOUR DEBATE SPACE
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#192F50]">
          Welcome back, Debater
        </h1>

        <p className="mt-2 text-slate-500">
          Challenge ideas, defend your arguments, and discover new perspectives.
        </p>
      </section>

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/debates/create"
          className="rounded-2xl bg-[#192F50] p-6 text-white transition hover:bg-[#304765]"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#D9AD60] text-xl font-bold text-[#192F50]">
            +
          </div>

          <h2 className="text-xl font-bold">Create a Debate</h2>

          <p className="mt-2 text-sm text-slate-300">
            Start a discussion and invite others to challenge your ideas.
          </p>

          <p className="mt-4 text-sm font-semibold text-[#D9AD60]">
            Create debate →
          </p>
        </Link>

        <Link
          href="/debates/discover"
          className="rounded-2xl border border-[#E5DFD2] bg-white p-6 transition hover:border-[#D9AD60]"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8EFED] text-xl text-[#5F9186]">
            ◉
          </div>

          <h2 className="text-xl font-bold text-[#192F50]">
            Discover Debates
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Explore public debates and join conversations that interest you.
          </p>

          <p className="mt-4 text-sm font-semibold text-[#B58A42]">
            Explore debates →
          </p>
        </Link>
      </section>

      {/* Public Debates Preview */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#192F50]">
              Public Debates
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Explore what the community is discussing.
            </p>
          </div>

          <Link
            href="/debates/discover"
            className="text-sm font-semibold text-[#B58A42] hover:underline"
          >
            View all →
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {publicDebates.map((debate) => (
            <article
              key={debate.title}
              className="rounded-2xl border border-[#E5DFD2] bg-white p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-medium text-[#9B7435]">
                  {debate.category}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    debate.status === "Live"
                      ? "bg-[#E8EFED] text-[#5F9186]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {debate.status}
                </span>
              </div>

              <h3 className="text-lg font-bold text-[#192F50]">
                {debate.title}
              </h3>

              <p className="mt-3 text-sm text-slate-500">
                {debate.participants} participants
              </p>

              <Link
                href="/debates/discover"
                className="mt-5 inline-block text-sm font-semibold text-[#B58A42] hover:underline"
              >
                View debate →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}