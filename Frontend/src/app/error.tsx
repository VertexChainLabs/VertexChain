"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111827] px-4 text-gray-200">
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-gray-100">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          An unexpected error occurred. You can try again or refresh the page.
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
