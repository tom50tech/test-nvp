"use client";

import { FormEvent, useState } from "react";
import type { TradeRow, TradeStats } from "@/lib/types";

interface Props {
  email: string;
}

interface UploadResponse {
  stats: TradeStats;
  rows: TradeRow[];
}

export default function DashboardClient({ email }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setData(null);
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setData(null);

    if (!file) {
      setError("Wybierz plik CSV z transakcjami.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Błąd podczas przetwarzania pliku");
      }

      const json = (await res.json()) as UploadResponse;
      setData(json);
    } catch (err: any) {
      setError(err.message || "Coś poszło nie tak");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 10px 25px rgba(15,23,42,0.1)"
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Panel użytkownika
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Zalogowano jako <strong>{email}</strong>
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            backgroundColor: "#ffffff",
            cursor: "pointer",
            fontSize: 13
          }}
        >
          Wyloguj
        </button>
      </header>

      <section style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 4
          }}
        >
          1. Wgraj plik CSV z transakcjami
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
          Plik powinien zawierać nagłówek z kolumnami:{" "}
          <code>
            data, instrument, typ, wolumen, cena_wejscia, cena_wyjscia, wynik
          </code>
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={{ marginBottom: 8 }}
          />
          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#b91c1c",
                backgroundColor: "#fef2f2",
                borderRadius: 6,
                padding: "6px 8px",
                marginBottom: 8
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !file}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              cursor: loading || !file ? "not-allowed" : "pointer",
              opacity: loading || !file ? 0.7 : 1,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {loading ? "Analizuję..." : "Przeanalizuj transakcje"}
          </button>
        </form>
      </section>

      {data && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              2. Podsumowanie wyników
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10
              }}
            >
              <StatCard
                label="Liczba transakcji"
                value={data.stats.totalTrades}
              />
              <StatCard
                label="Win rate"
                value={data.stats.winRate.toFixed(2) + " %"}
              />
              <StatCard
                label="Suma zysków i strat"
                value={data.stats.totalPnL.toFixed(2)}
              />
              <StatCard
                label="Średni zysk / średnia strata"
                value={
                  data.stats.avgProfit.toFixed(2) +
                  " / " +
                  data.stats.avgLoss.toFixed(2)
                }
              />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              3. Lista transakcji
            </h2>
            <div
              style={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                overflow: "auto",
                maxHeight: 320
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12
                }}
              >
                <thead style={{ backgroundColor: "#f1f5f9" }}>
                  <tr>
                    <Th>Data</Th>
                    <Th>Instrument</Th>
                    <Th>Typ</Th>
                    <Th>Wolumen</Th>
                    <Th>Cena wejścia</Th>
                    <Th>Cena wyjścia</Th>
                    <Th>Wynik</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor:
                          idx % 2 === 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      <Td>{row.data}</Td>
                      <Td>{row.instrument}</Td>
                      <Td>{row.typ}</Td>
                      <Td>{row.wolumen}</Td>
                      <Td>{row.cena_wejscia}</Td>
                      <Td>{row.cena_wyjscia}</Td>
                      <Td
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid #e2e8f0",
                          whiteSpace: "nowrap",
                          color:
                            row.wynik > 0
                              ? "#15803d"
                              : row.wynik < 0
                              ? "#b91c1c"
                              : "#0f172a"
                        }}
                      >
                        {row.wynik}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        padding: 10
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 8px",
        borderBottom: "1px solid #e2e8f0",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "6px 8px",
        borderBottom: "1px solid #e2e8f0",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </td>
  );
}
