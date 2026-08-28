"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">Request blocked</p>
      <p>
        This action or page is not permitted for your role, or the record could not be
        loaded. The denial has been written to the audit log.
      </p>
      <button onClick={reset} className="mt-3 rounded bg-red-700 px-3 py-1.5 text-white">
        Try again
      </button>
    </div>
  );
}
