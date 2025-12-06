import type { TradeRow, TradeStats } from "./types";

export function parseCsv(content: string): TradeRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const idxData = header.indexOf("data");
  const idxInstrument = header.indexOf("instrument");
  const idxTyp = header.indexOf("typ");
  const idxWolumen = header.indexOf("wolumen");
  const idxCenaWejscia = header.indexOf("cena_wejscia");
  const idxCenaWyjscia = header.indexOf("cena_wyjscia");
  const idxWynik = header.indexOf("wynik");

  const required = [
    idxData,
    idxInstrument,
    idxTyp,
    idxWolumen,
    idxCenaWejscia,
    idxCenaWyjscia,
    idxWynik
  ];

  if (required.some((i) => i === -1)) {
    throw new Error(
      "Brak wymaganych kolumn w nagłówku CSV. Sprawdź nazwy kolumn."
    );
  }

  const rows: TradeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < header.length) continue;

    const datum = parts[idxData] || "";
    const instrument = parts[idxInstrument] || "";
    const typ = parts[idxTyp] || "";
    const wolumen = Number(parts[idxWolumen] || "0");
    const cena_wejscia = Number(parts[idxCenaWejscia] || "0");
    const cena_wyjscia = Number(parts[idxCenaWyjscia] || "0");
    const wynik = Number(parts[idxWynik] || "0");

    if (!instrument || !typ || isNaN(wynik)) continue;

    rows.push({
      data: datum,
      instrument,
      typ,
      wolumen: isNaN(wolumen) ? 0 : wolumen,
      cena_wejscia: isNaN(cena_wejscia) ? 0 : cena_wejscia,
      cena_wyjscia: isNaN(cena_wyjscia) ? 0 : cena_wyjscia,
      wynik
    });
  }

  return rows;
}

export function calculateStats(rows: TradeRow[]): TradeStats {
  const totalTrades = rows.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgProfit: 0,
      avgLoss: 0
    };
  }

  let winningTrades = 0;
  let losingTrades = 0;
  let totalPnL = 0;
  let totalProfit = 0;
  let totalLossAbs = 0;

  for (const r of rows) {
    totalPnL += r.wynik;
    if (r.wynik > 0) {
      winningTrades += 1;
      totalProfit += r.wynik;
    } else if (r.wynik < 0) {
      losingTrades += 1;
      totalLossAbs += Math.abs(r.wynik);
    }
  }

  const winRate = (winningTrades / totalTrades) * 100;
  const avgProfit = winningTrades > 0 ? totalProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLossAbs / losingTrades : 0;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalPnL,
    avgProfit,
    avgLoss
  };
}
