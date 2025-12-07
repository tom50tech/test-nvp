import { NextRequest, NextResponse } from "next/server";
import type { TradeRow, TradeStats } from "@/lib/types";

// mapowanie różnych nazw kolumn na nasze "kanoniczne"
const HEADER_MAP: Record<string, keyof TradeRow | "wynik"> = {
  // data
  "data": "data",
  "date": "data",
  "time": "data",
  "open time": "data",
  "open_time": "data",

  // instrument
  "instrument": "instrument",
  "symbol": "instrument",
  "pair": "instrument",
  "para": "instrument",

  // typ
  "typ": "typ",
  "type": "typ",
  "side": "typ",
  "direction": "typ",

  // wolumen
  "wolumen": "wolumen",
  "volume": "wolumen",
  "size": "wolumen",
  "qty": "wolumen",
  "quantity": "wolumen",

  // cena wejścia
  "cena_wejscia": "cena_wejscia",
  "open": "cena_wejscia",
  "open price": "cena_wejscia",
  "price open": "cena_wejscia",
  "entry price": "cena_wejscia",
  "open_price": "cena_wejscia",

  // cena wyjścia
  "cena_wyjscia": "cena_wyjscia",
  "close": "cena_wyjscia",
  "close price": "cena_wyjscia",
  "price close": "cena_wyjscia",
  "exit price": "cena_wyjscia",
  "close_price": "cena_wyjscia",

  // wynik / profit
  "wynik": "wynik",
  "profit": "wynik",
  "p/l": "wynik",
  "pnl": "wynik",
  "zysk": "wynik",
  "zysk/strata": "wynik"
};

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeType(raw: string | undefined): string {
  const v = (raw || "").trim().toUpperCase();
  if (v.startsWith("BUY") || v === "LONG") return "BUY";
  if (v.startsWith("SELL") || v === "SHORT") return "SELL";
  return v;
}

function computeStats(rows: TradeRow[]): TradeStats {
  const totalTrades = rows.length;

  let wins = 0;
  let losses = 0;
  let totalPnL = 0;
  let sumProfit = 0;
  let sumLoss = 0;

  for (const r of rows) {
    totalPnL += r.wynik;

    if (r.wynik > 0) {
      wins += 1;
      sumProfit += r.wynik;
    } else if (r.wynik < 0) {
      losses += 1;
      sumLoss += r.wynik;
    }
  }

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgProfit = wins > 0 ? sumProfit / wins : 0;
  const avgLoss = losses > 0 ? sumLoss / losses : 0;

  return {
    totalTrades,
    winRate,
    totalPnL,
    avgProfit,
    avgLoss
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Brak pliku w żądaniu." },
        { status: 400 }
      );
    }

    const text = await file.text();

    // wykrywanie separatora: jeśli dużo średników, przyjmujemy ';'
    const firstLine = text.split(/\r?\n/)[0] || "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolons > commas ? ";" : ",";

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json(
        { message: "Plik nie zawiera żadnych danych." },
        { status: 400 }
      );
    }

    const headerRaw = lines[0].split(delimiter);
    const headerIndexes: Partial<
      Record<keyof TradeRow | "wynik", number>
    > = {};

    headerRaw.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      const mapped = HEADER_MAP[norm];
      if (mapped) {
        headerIndexes[mapped] = idx;
      }
    });

    // minimalne wymagania:
    // - data, instrument, typ
    // - oraz (wynik) LUB (cena_wejscia + cena_wyjscia)
    if (
      headerIndexes.data === undefined ||
      headerIndexes.instrument === undefined ||
      headerIndexes.typ === undefined ||
      (headerIndexes.wynik === undefined &&
        (headerIndexes.cena_wejscia === undefined ||
          headerIndexes.cena_wyjscia === undefined))
    ) {
      return NextResponse.json(
        {
          message:
            "Nie udało się dopasować kolumn. Upewnij się, że plik zawiera co najmniej: datę, instrument, typ, oraz wynik albo ceny wejścia/wyjścia.",
          debug: { headerRaw, headerIndexes }
        },
        { status: 400 }
      );
    }

    const rows: TradeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(delimiter);

      // pomijamy ew. puste linie na końcu
      if (parts.every((p) => p.trim() === "")) continue;

      const get = (idx: number | undefined): string | undefined =>
        idx === undefined ? undefined : parts[idx];

      const data = (get(headerIndexes.data) || "").trim();
      const instrument = (get(headerIndexes.instrument) || "").trim();
      const typ = normalizeType(get(headerIndexes.typ));
      const wolumen = normalizeNumber(get(headerIndexes.wolumen));

      const cena_wejscia = normalizeNumber(
        get(headerIndexes.cena_wejscia)
      );
      const cena_wyjscia = normalizeNumber(
        get(headerIndexes.cena_wyjscia)
      );

      let wynik: number;
      if (headerIndexes.wynik !== undefined) {
        wynik = normalizeNumber(get(headerIndexes.wynik));
      } else {
        // fallback: wynik z różnicy cen * wolumen
        // (prosty model, ale lepszy niż nic)
        const diff = typ === "SELL"
          ? cena_wejscia - cena_wyjscia
          : cena_wyjscia - cena_wejscia;
        wynik = diff * (wolumen || 1);
      }

      rows.push({
        data,
        instrument,
        typ,
        wolumen,
        cena_wejscia,
        cena_wyjscia,
        wynik
      });
    }

    const stats = computeStats(rows);

    return NextResponse.json({
      stats,
      rows
    });
  } catch (error: any) {
    console.error("CSV upload error:", error);
    return NextResponse.json(
      { message: "Błąd podczas przetwarzania pliku CSV." },
      { status: 500 }
    );
  }
}
