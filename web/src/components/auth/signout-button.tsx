
"use client";

export default function SignOutButton() {
  return (
    <form action="/logout" method="POST">
      <button
        type="submit"
        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700" >
        Sign Out
      </button>
    </form>
  );
}
