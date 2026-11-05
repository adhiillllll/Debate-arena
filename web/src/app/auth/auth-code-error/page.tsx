
export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md rounded-xl bg-white p-8 text-center shadow">
        <h1 className="mb-3 text-2xl font-bold">
          Email confirmation failed
        </h1>

        <p className="mb-6 text-gray-600">
          The confirmation link may have expired or already been used.
          Please try signing up again or request a new confirmation email.
        </p>

        <a
          href="/signup"
          className="inline-block rounded-md bg-black px-4 py-2 text-white" >
          Back to sign up
        </a>
      </div>
    </main>
  );
}
