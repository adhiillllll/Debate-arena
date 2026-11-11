"use client";

import { useMemo, useState } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { useRouter } from "next/navigation";

type Friend = {
    id: number;
    name: string;
    username: string;
    status: "online" | "offline";
    debates: number;
};

const initialFriends: Friend[] = [
    {
        id: 1,
        name: "Alex Morgan",
        username: "@alexmorgan",
        status: "online",
        debates: 12,
    },
    {
        id: 2,
        name: "Sarah Wilson",
        username: "@sarahw",
        status: "offline",
        debates: 8,
    },
    {
        id: 3,
        name: "David Thomas",
        username: "@davidthomas",
        status: "online",
        debates: 15,
    },
    {
        id: 4,
        name: "Emma Johnson",
        username: "@emmaj",
        status: "offline",
        debates: 6,
    },
];

export default function FriendsPage() {
    const [friends, setFriends] = useState(initialFriends);
    const [search, setSearch] = useState("");
    const [selectedTab, setSelectedTab] = useState<"all" | "online">("all");

    const router = useRouter();

    const filteredFriends = useMemo(() => {
        return friends.filter((friend) => {
            const matchesSearch =
                friend.name.toLowerCase().includes(search.toLowerCase()) ||
                friend.username.toLowerCase().includes(search.toLowerCase());

            const matchesTab =
                selectedTab === "all" || friend.status === "online";

            return matchesSearch && matchesTab;
        });
    }, [friends, search, selectedTab]);

    const removeFriend = (id: number) => {
        setFriends((current) => current.filter((friend) => friend.id !== id));
    };

    return (
        <div className="min-h-screen bg-[#F8F5EC] text-[#192F50]">
            <DashboardSidebar />

            <main className="min-h-screen md:ml-64">
                <div className="mx-auto max-w-7xl p-6 md:p-10">
                    <div className="mb-8">
                        <p className="text-sm font-medium text-[#9A7B43]">
                            SOCIAL
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Friends
                        </h1>

                        <p className="mt-2 text-sm text-gray-600">
                            Connect with people and invite them to your debates.
                        </p>
                    </div>

                    {/* Summary */}
                    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-5">
                            <p className="text-sm text-gray-500">Total Friends</p>
                            <p className="mt-2 text-3xl font-bold">{friends.length}</p>
                        </div>

                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-5">
                            <p className="text-sm text-gray-500">Online Friends</p>
                            <p className="mt-2 text-3xl font-bold">
                                {friends.filter((friend) => friend.status === "online").length}
                            </p>
                        </div>
                    </div>

                    {/* Search and tabs */}
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search friends..."
                            className="w-full rounded-xl border border-[#E7DFCF] bg-white px-4 py-3 outline-none focus:border-[#D9AD60] sm:max-w-md"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedTab("all")}
                                className={`rounded-xl px-4 py-2 text-sm font-medium ${selectedTab === "all"
                                    ? "bg-[#192F50] text-white"
                                    : "border border-[#E7DFCF] bg-white"
                                    }`}
                            >
                                All Friends
                            </button>

                            <button
                                onClick={() => setSelectedTab("online")}
                                className={`rounded-xl px-4 py-2 text-sm font-medium ${selectedTab === "online"
                                    ? "bg-[#192F50] text-white"
                                    : "border border-[#E7DFCF] bg-white"
                                    }`}
                            >
                                Online
                            </button>
                        </div>
                    </div>

                    {/* Friends list */}
                    {filteredFriends.length === 0 ? (
                        <div className="rounded-2xl border border-[#E7DFCF] bg-white p-10 text-center">
                            <h2 className="font-semibold">No friends found</h2>
                            <p className="mt-2 text-sm text-gray-500">
                                Try another search.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {filteredFriends.map((friend) => (
                                <div
                                    key={friend.id}
                                    className="flex flex-col gap-4 rounded-2xl border border-[#E7DFCF] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#192F50] font-bold text-white">
                                            {friend.name
                                                .split(" ")
                                                .map((part) => part[0])
                                                .join("")}

                                            <span
                                                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${friend.status === "online"
                                                    ? "bg-green-500"
                                                    : "bg-gray-400"
                                                    }`}
                                            />
                                        </div>

                                        <div>
                                            <h2 className="font-semibold">{friend.name}</h2>
                                            <p className="text-sm text-gray-500">
                                                {friend.username}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {friend.debates} debates participated
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => router.push("/invitations")}
                                            className="rounded-xl bg-[#D9AD60] px-4 py-2 text-sm font-semibold text-[#192F50] transition hover:bg-[#C99A4C]"
                                        >
                                            Invite
                                        </button>

                                        <button
                                            onClick={() => removeFriend(friend.id)}
                                            className="rounded-xl border border-[#E7DFCF] px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="mt-6 text-xs text-gray-400">
                        Demo data only. Friend management will be connected to the backend later.
                    </p>
                </div>
            </main>
        </div>
    );
}