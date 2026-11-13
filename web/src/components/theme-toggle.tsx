"use client";

import { useSyncExternalStore } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

const storageKey = "debate-arena-theme";
const themeEvent = "debate-arena-theme-change";

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

function subscribe(onChange: () => void) {
  function syncTheme() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "night" || saved === "light") {
        document.documentElement.classList.toggle("dark", saved === "night");
      }
    } catch {
      // Switching still works when browser storage is unavailable.
    }
    onChange();
  }

  syncTheme();
  window.addEventListener("storage", syncTheme);
  window.addEventListener(themeEvent, onChange);
  return () => {
    window.removeEventListener("storage", syncTheme);
    window.removeEventListener(themeEvent, onChange);
  };
}

export default function ThemeToggle() {
  const isNight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = isNight ? "Switch to light mode" : "Switch to night mode";

  function toggleTheme() {
    const nextIsNight = !getSnapshot();
    document.documentElement.classList.toggle("dark", nextIsNight);
    try {
      localStorage.setItem(storageKey, nextIsNight ? "night" : "light");
    } catch {
      // Keep the selected theme for this visit without persistence.
    }
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isNight}
      title={label}
      className="mb-3 flex min-h-11 w-full shrink-0 items-center gap-3 rounded-xl border border-[#D9AD60] bg-[#F8F5EC] px-3 py-2 text-sm font-semibold text-[#192F50] hover:bg-[#F3EBDD] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9AD60] dark:bg-[#20334E] dark:text-[#D9AD60] dark:hover:bg-[#304765]"
    >
      {isNight ? <FiSun size={20} aria-hidden="true" /> : <FiMoon size={20} aria-hidden="true" />}
      <span>{isNight ? "Light mode" : "Night mode"}</span>
    </button>
  );
}
