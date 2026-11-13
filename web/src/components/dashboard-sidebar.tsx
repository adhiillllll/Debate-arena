"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiHome, FiPlusCircle, FiCompass, FiMessageSquare, FiUsers, FiMail, FiUser } from "react-icons/fi";
import SignOutButton from "@/components/auth/signout-button";
import ThemeToggle from "@/components/theme-toggle";

const navigation = [
  { name: "Dashboard", href: "/", icon: FiHome },
  { name: "Create Debate", href: "/debates/create", icon: FiPlusCircle },
  { name: "Discover Debates", href: "/debates/discover", icon: FiCompass },
  { name: "My Debates", href: "/debates", icon: FiMessageSquare },
  { name: "Friends", href: "/friends", icon: FiUsers },
  { name: "Invitations", href: "/invitations", icon: FiMail },
  { name: "Profile", href: "/profile", icon: FiUser },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Use the most specific match so Create/Discover don't also select My Debates.
  const activeHref = navigation
    .filter((item) => pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="w-full shrink-0 bg-[#192F50] px-4 py-4 text-[#F8F5EC] md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:flex-col md:overflow-y-auto md:py-5">

      <div className="flex items-center justify-between gap-3 md:mb-8">
      <Link href="/" className="flex min-w-0 items-center gap-3 px-2" onClick={() => setMenuOpen(false)}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E2B566] font-bold text-[#192F50]">
          DA
        </div>

        <div>
          <span className="block text-lg font-bold tracking-tight">
            Debate Arena
          </span>
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#D6B875]">
            Speak. Challenge. Prove.
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="dashboard-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
        className="shrink-0 rounded-xl border border-[#52637C] px-3 py-2 text-sm font-semibold hover:bg-[#304765] md:hidden"
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      </div>

      <div id="dashboard-navigation" className={`${menuOpen ? "flex" : "hidden"} mt-4 flex-col md:mt-0 md:flex md:flex-1`}>
      <nav aria-label="Dashboard navigation" className="flex flex-1 flex-col gap-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeHref === item.href;

          const isCreate = item.href === "/debates/create";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                isActive
                  ? isCreate
                    ? "ring-2 ring-inset ring-[#F8F5EC] "
                    : "ring-2 ring-inset ring-[#D9AD60] "
                  : ""
              }${
                isCreate
                  ? "bg-[#D9AD60] font-semibold text-[#192F50] hover:bg-[#E4BE7D]"
                  : isActive
                    ? "bg-[#304765] font-semibold text-white"
                    : "text-[#D3DCE8] hover:bg-[#263D5C] hover:text-white"
              }`} >

              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center text-base">
                <Icon size={18} />
              </span>

              <span>{item.name}</span>

              {isCreate && <span className="ml-auto">→</span>}

            </Link>
          );
        })}
      </nav>

      <div className="mt-6 shrink-0 border-t border-[#344966] pt-4 pb-1">
        <ThemeToggle />
        <SignOutButton />
      </div>
      </div>
    </aside>
  );
}
