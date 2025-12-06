"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Wystąpił błąd");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Coś poszło nie tak");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#ffffff",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 10px 25px rgba(15,23,42,0.15)"
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 8
        }}
      >
        Trading CSV Analyzer
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#64748b",
          textAlign: "center",
          marginBottom: 16
        }}
      >
        Zarejestruj się lub zaloguj, aby przeanalizować swoje transakcje z pliku CSV.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginBottom: 16
        }}
      >
        <button
          type="button"
          onClick={() => setMode("login")}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #0f172a",
            backgroundColor: mode === "login" ? "#0f172a" : "#ffffff",
            color: mode === "login" ? "#ffffff" : "#0f172a",
            cursor: "pointer",
            fontSize: 13
          }}
        >
          Logowanie
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #0f172a",
            backgroundColor: mode === "register" ? "#0f172a" : "#ffffff",
            color: mode === "register" ? "#ffffff" : "#0f172a",
            cursor: "pointer",
            fontSize: 13
          }}
        >
          Rejestracja
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="email"
            style={{ display: "block", fontSize: 13, marginBottom: 4 }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #cbd5e1"
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="password"
            style={{ display: "block", fontSize: 13, marginBottom: 4 }}
          >
            Hasło
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #cbd5e1"
            }}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#b91c1c",
              backgroundColor: "#fef2f2",
              borderRadius: 6,
              padding: "6px 8px",
              marginBottom: 10
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            fontWeight: 600
          }}
        >
          {loading ? "Przetwarzanie..." : mode === "login" ? "Zaloguj" : "Zarejestruj"}
        </button>
      </form>
    </main>
  );
}
