"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="glass mx-auto mt-24 max-w-md p-8 text-center">
      <AlertTriangle className="mx-auto mb-3 size-8 text-warn" />
      <h1 className="font-semibold">Couldn’t load this page</h1>
      <p className="mt-2 text-sm text-muted">
        Check that the Spring Boot backend is running, then try again.
      </p>
      <button onClick={reset} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
        Try again
      </button>
    </div>
  );
}
