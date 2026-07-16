"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MapError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#111827] px-4 text-gray-200">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-8 text-center shadow-lg">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <svg
            aria-hidden="true"
            className="h-12 w-12 text-[#6366f1]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-gray-100">
          Map failed to load
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          There was a problem rendering the map. You can try again or refresh
          the page.
        </p>

        <button
          onClick={reset}
          className="rounded-lg bg-[#6366f1] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366f1]"
          type="button"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
