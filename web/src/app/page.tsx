
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import HomeClient from "@/components/home-client";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          Loading Debate Arena...
        </main>
      }
    >
      <AuthenticatedHome />
    </Suspense>
  );
}

async function AuthenticatedHome() {
  await connection()

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const userId = data.claims.sub;
  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : null;

  const existingProfile = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingProfile) {
    try {
      await prisma.user.create({
        data: {
          id: userId,
          displayName: email?.split("@")[0] ?? "Debate User",
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        // Concurrent request already created this profile.
      } else {
        throw error;
      }
    }
  }

  return <HomeClient />;
}
