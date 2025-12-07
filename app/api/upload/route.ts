import { NextRequest, NextResponse } from "next/server";
import type { TradeRow, TradeStats } from "@/lib/types";

/**
 * Map various possible CSV header names to our canonical TradeRow keys.
 * We keep code in English, UI can be translated separately.
 */
const HEADER_MAP: Record<string, keyof TradeRow | "wynik"> = {
  // date / time
  "data": "data",
  "date": "data",
  "time": "data",
  "open time": "data",
  "open_time": "data",

  // instrument / symbol / pair
  "instrument": "instrument",
  "symbol": "instrument",
  "pair": "instrument",
  "para": "instrument",

  // side / type
  "typ": "typ",
  "type": "typ",
  "side": "typ",
  "direction": "typ",

  // volume / size
  "wolumen": "wolumen",
  "volume": "wolumen",
  "size": "wolumen",
  "qty": "wolumen",
  "quantity": "wolumen",

  // entry price
  "cena_wejscia": "cena_wejscia",
  "open": "cena_wejscia",
  "open price": "cena_wejscia",
  "price open": "cena_wejscia",
  "entry price": "cena_wejscia",
  "open_price": "cena_wejscia",

  // exit price
  "cena_wyjscia": "cena_wyjscia",
  "close": "cena_wyjscia",
  "close price": "cena_wyjscia",
  "price close": "cena_wyjscia",
  "exit price": "cena_wyjscia",
  "close_price": "cena_wyjscia",

  // profit / result
  "wynik": "wynik",
  "profit": "wynik",
  "p/l": "wynik",
  "pnl": "wynik",
  "p&l": "wynik",
  "zysk": "wynik",
  "zysk/strata": "wynik"
};

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNumber(raw: string | undefined): number {
  if (!raw) return 0;
  // remove spaces, change comma to dot
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeType(raw: string | undefined): string {
  const v = (raw || "").trim().toUpperCase();
  if (v.startsWith("BUY") || v === "LONG") return "BUY";
  if (v.startsWith("SELL") || v === "SHORT") return "SELL";
  return v || "UNKNOWN";
}

/**
 * Compute basic statistics for the uploaded trades.
 * Matches TradeStats type: totalTrades, winRate, totalPnL, avgProfit, avgLoss, winTrades, losingTrades
 */
function computeStats(rows: TradeRow[]): TradeStats {
  const totalTrades = rows.length;

  let winTrades = 0;
  let losingTrades = 0;
  let totalPnL = 0;
  let sumProfit = 0;
  let sumLoss = 0;

  for (const r of rows) {
    totalPnL += r.wynik;

    if (r.wynik > 0) {
      winTrades += 1;
      sumProfit += r.wynik;
    } else if (r.wynik < 0) {
      losingTrades += 1;
      sumLoss += r.wynik;
    }
  }

  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const avgProfit = winTrades > 0 ? sumProfit / winTrades : 0;
  const avgLoss = losingTrades > 0 ? sumLoss / losingTrades : 0;

  return {
    totalTrades,
    winRate,
    totalPnL,
    avgProfit,
    avgLoss,
    winTrades,
    losingTrades
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "No file provided in request." },
        { status: 400 }
      );
    }

    const text = await file.text();

    // Detect delimiter: if there are more semicolons than commas in header -> use ';'
    const firstLine = text.split(/\r?\n/)[0] || "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolons > commas ? ";" : ",";

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { message: "CSV file does not contain data rows." },
        { status: 400 }
      );
    }

    const headerRaw = lines[0].split(delimiter);
    const headerIndexes: Partial<Record<keyof TradeRow | "wynik", number>> = {};

    headerRaw.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      const mapped = HEADER_MAP[norm];
      if (mapped) {
        headerIndexes[mapped] = idx;
      }
    });

    // Minimal requirements:
    // - date, instrument, type
    // AND
    // - either explicit wynik/profit
    //   OR entry + exit price to compute wynik
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
            "Could not match required columns. File must contain at least: date, instrument, type, and either profit or entry/exit prices.",
          debug: { headerRaw, headerIndexes }
        },
        { status: 400 }
      );
    }

    const rows: TradeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(delimiter);

      // skip empty rows (just in case)
      if (parts.every((p) => p.trim() === "")) continue;

      const get = (idx: number | undefined): string | undefined =>
        idx === undefined ? undefined : parts[idx];

      const data = (get(headerIndexes.data) || "").trim();
      const instrument = (get(headerIndexes.instrument) || "").trim();
      const typ = normalizeType(get(headerIndexes.typ));
      const wolumen = normalizeNumber(get(headerIndexes.wolumen));

      const cena_wejscia = normalizeNumber(get(headerIndexes.cena_wejscia));
      const cena_wyjscia = normalizeNumber(get(headerIndexes.cena_wyjscia));

      let wynik: number;
      if (headerIndexes.wynik !== undefined) {
        wynik = normalizeNumber(get(headerIndexes.wynik));
      } else {
        // fallback: compute wynik from price difference * volume
        const diff =
          typ === "SELL"
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

    return NextResponse.json(
      {
        stats,
        rows
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CSV upload error:", error);
    return NextResponse.json(
      { message: "Error while processing CSV file." },
      { status: 500 }
    );
  }
}
