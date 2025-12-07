// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Wewnętrzny ujednolicony typ transakcji
type NormalizedTrade = {
  date: string;
  instrument: string;
  type: string; // BUY / SELL / itp.
  volume?: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
};

// Alias nagłówków – obsługujemy PL + EN + typowe warianty
const COLUMN_ALIASES = {
  date: ['date', 'data', 'open time', 'open_time', 'czas otwarcia', 'czas_otwarcia'],
  instrument: ['instrument', 'symbol', 'market', 'rynek'],
  type: ['type', 'typ', 'side', 'direction', 'kierunek'],
  volume: ['volume', 'wolumen', 'size', 'ilosc', 'ilość'],
  entryPrice: [
    'entry price',
    'entry_price',
    'entry',
    'cena wejścia',
    'cena_wejscia',
    'open',
    'open price',
    'price_open',
  ],
  exitPrice: [
    'exit price',
    'exit_price',
    'exit',
    'cena wyjścia',
    'cena_wyjscia',
    'close',
    'close price',
    'price_close',
  ],
  profit: ['profit', 'p/l', 'p&l', 'wynik', 'zysk/strata', 'zysk', 'strata', 'gross p/l', 'net p/l'],
};

function normalizeHeader(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD') // usuń ogonki
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ''); // usuń spacje, kropki itp.
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const match = normalizedHeaders.find((h) => h.normalized === normAlias);
    if (match) return match.original;
  }

  return null;
}

// Prosty parser CSV bez zewnętrznych bibliotek
function parseCsv(text: string): any[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerLine = lines[0];

  // Wykrywamy separator: ; lub , (prosto, ale działa w typowych plikach brokerów)
  let delimiter = ',';
  if (headerLine.includes(';') && !headerLine.includes(',')) {
    delimiter = ';';
  }

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const parts = line.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length === 1 && parts[0] === '') continue;

    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = parts[idx] ?? '';
    });
    rows.push(obj);
  }

  return rows;
}

// Mapowanie dowolnego CSV (PL/EN) do naszego wewnętrznego formatu
function mapGenericCsv(rows: any[]): NormalizedTrade[] {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);

  const dateCol = findColumn(headers, COLUMN_ALIASES.date);
  const instrumentCol = findColumn(headers, COLUMN_ALIASES.instrument);
  const typeCol = findColumn(headers, COLUMN_ALIASES.type);
  const volumeCol = findColumn(headers, COLUMN_ALIASES.volume);
  const entryCol = findColumn(headers, COLUMN_ALIASES.entryPrice);
  const exitCol = findColumn(headers, COLUMN_ALIASES.exitPrice);
  const profitCol = findColumn(headers, COLUMN_ALIASES.profit);

  if (!dateCol || !instrumentCol || !typeCol || (!profitCol && (!entryCol || !exitCol))) {
    throw new Error(
      'Could not match required columns. File must contain at least: date, instrument, type, and either profit or entry/exit prices.'
    );
  }

  return rows.map((row) => {
    const rawType = String(row[typeCol!] ?? '').toLowerCase();

    const typeNorm =
      rawType.startsWith('b') || rawType.includes('kup')
        ? 'BUY'
        : rawType.startsWith('s') || rawType.includes('sprz')
        ? 'SELL'
        : rawType.toUpperCase() || 'UNKNOWN';

    const volumeRaw = volumeCol ? String(row[volumeCol]) : '';
    const volume = volumeRaw ? Number(volumeRaw.replace(',', '.')) : undefined;

    let entryPrice: number | undefined;
    let exitPrice: number | undefined;
    let profit: number | undefined;

    const profitRaw = profitCol ? String(row[profitCol] ?? '') : '';

    if (profitRaw !== '') {
      profit = Number(profitRaw.replace(',', '.'));
    } else {
      const entryRaw = entryCol ? String(row[entryCol] ?? '') : '';
      const exitRaw = exitCol ? String(row[exitCol] ?? '') : '';

      if (entryRaw !== '') {
        entryPrice = Number(entryRaw.replace(',', '.'));
      }
      if (exitRaw !== '') {
        exitPrice = Number(exitRaw.replace(',', '.'));
      }

      if (entryPrice !== undefined && exitPrice !== undefined) {
        profit = typeNorm === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
      }
    }

    const clean = (v: number | undefined) =>
      v === undefined || Number.isNaN(v) ? undefined : v;

    return {
      date: String(row[dateCol!]),
      instrument: String(row[instrumentCol!]),
      type: typeNorm,
      volume: clean(volume),
      entryPrice: clean(entryPrice),
      exitPrice: clean(exitPrice),
      profit: clean(profit),
    };
  });
}

// Proste statystyki – bez osobnego typu, żeby TS się nie czepiał
function calculateStats(trades: NormalizedTrade[]) {
  const totalTrades = trades.length;

  if (!totalTrades) {
    return {
      totalTrades: 0,
      winTrades: 0,
      loseTrades: 0,
      winRate: 0,
      avgProfit: 0,
      avgLoss: 0,
    };
  }

  const withProfit = trades.filter((t) => typeof t.profit === 'number') as {
    profit: number;
  }[];

  const winTrades = withProfit.filter((t) => t.profit > 0).length;
  const loseTrades = withProfit.filter((t) => t.profit < 0).length;

  const winRate = totalTrades ? (winTrades / totalTrades) * 100 : 0;

  const totalProfit = withProfit
    .filter((t) => t.profit > 0)
    .reduce((s, t) => s + t.profit, 0);
  const totalLoss = withProfit
    .filter((t) => t.profit < 0)
    .reduce((s, t) => s + t.profit, 0); // ujemne

  const avgProfit = winTrades ? totalProfit / winTrades : 0;
  const avgLoss = loseTrades ? totalLoss / loseTrades : 0;

  return {
    totalTrades,
    winTrades,
    loseTrades,
    winRate,
    avgProfit,
    avgLoss,
  };
}

// Główna trasa API – JEDYNY eksport wymagany przez Next.js
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nie przesłano pliku.' }, { status: 400 });
    }

    const text = await file.text();

    const rows = parseCsv(text);

    const trades = mapGenericCsv(rows);
    const stats = calculateStats(trades);

    return NextResponse.json(
      {
        success: true,
        stats,
        trades, // można usunąć, jeśli front nie potrzebuje
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('UPLOAD ERROR:', error);

    return NextResponse.json(
      {
        error: error?.message || 'Błąd podczas przetwarzania pliku',
      },
      { status: 500 }
    );
  }
}
