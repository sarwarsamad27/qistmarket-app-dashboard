"use client";

// Last-resort screen when the root layout itself fails to render.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f4f6" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Something went wrong</h2>
            <p style={{ marginTop: 8, fontSize: 14, color: "#4b5563" }}>
              The application could not be loaded. Please check your internet connection and try again.
            </p>
            {error.digest && <p style={{ fontSize: 12, color: "#9ca3af" }}>Ref: {error.digest}</p>}
            <button
              onClick={reset}
              style={{ marginTop: 16, background: "#ff3d3d", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
