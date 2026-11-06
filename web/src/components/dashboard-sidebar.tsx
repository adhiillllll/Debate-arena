"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/auth/signout-button";

const navigation = [
  { name: "Dashboard", href: "/", icon: "⌂" },
  { name: "Create Debate", href: "/debates/create", icon: "+" },
  { name: "Discover Debates", href: "/debates/discover", icon: "◉" },
  { name: "My Debates", href: "/debates", icon: "▤" },
  { name: "Friends", href: "/friends", icon: "♧" },
  { name: "Invitations", href: "/invitations", icon: "✉" },
  { name: "Profile", href: "/profile", icon: "◎" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-[#192F50] px-4 py-5 text-[#F8F5EC]">

      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E2B566] font-bold text-[#192F50]">
          DA
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Debate Arena
          </h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#D6B875]">
            Speak. Challenge. Prove.
          </p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-2">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

          const isCreate = item.href === "/debates/create";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                isCreate
                  ? "bg-[#D9AD60] font-semibold text-[#192F50] hover:bg-[#E4BE7D]"
                  : isActive
                    ? "bg-[#304765] font-semibold text-white"
                    : "text-[#D3DCE8] hover:bg-[#263D5C] hover:text-white"
              }`} >

              <span className="flex h-5 w-5 items-center justify-center text-base">
                {item.icon}
              </span>

              <span>{item.name}</span>

              {isCreate && <span className="ml-auto">→</span>}

            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-[#344966] pt-4">
        <SignOutButton />
      </div>
    </aside>
  );
}