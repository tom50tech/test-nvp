// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

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
    .replace(/[^a-z0-9]/g, ''); // usuń spacje, kropki, itp.
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

  // Inteligentna walidacja wymaganych pól
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

    const volume = volumeCol ? Number(String(row[volumeCol]).replace(',', '.')) : undefined;

    let entryPrice: number | undefined;
    let exitPrice: number | undefined;
    let profit: number | undefined;

    if (profitCol && row[profitCol] !== undefined && row[profitCol] !== '') {
      profit = Number(String(row[profitCol]).replace(',', '.'));
    } else {
      if (entryCol && row[entryCol] !== undefined && row[entryCol] !== '') {
        entryPrice = Number(String(row[entryCol]).replace(',', '.'));
      }
      if (exitCol && row[exitCol] !== undefined && row[exitCol] !== '') {
        exitPrice = Number(String(row[exitCol]).replace(',', '.'));
      }
      if (entryPrice !== undefined && exitPrice !== undefined) {
        profit = typeNorm === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
      }
    }

    return {
      date: String(row[dateCol!]),
      instrument: String(row[instrumentCol!]),
      type: typeNorm,
      volume: isNaN(volume ?? NaN) ? undefined : volume,
      entryPrice: isNaN(entryPrice ?? NaN) ? undefined : entryPrice,
      exitPrice: isNaN(exitPrice ?? NaN) ? undefined : exitPrice,
      profit: isNaN(profit ?? NaN) ? undefined : profit,
    };
  });
}

// Proste statystyki – BEZ typowania TradeStats, żeby TS się nie czepiał
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

  const withProfit = trades.filter((t) => typeof t.profit === 'number') as Required<
    Pick<NormalizedTrade, 'profit'>
  >[];

  const winTrades = withProfit.filter((t) => t.profit > 0).length;
  const loseTrades = withProfit.filter((t) => t.profit < 0).length;

  const winRate = totalTrades ? (winTrades / totalTrades) * 100 : 0;

  const totalProfit = withProfit.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const totalLoss = withProfit.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0); // będzie ujemne

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

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.error('CSV PARSE ERRORS:', parsed.errors);
      return NextResponse.json(
        { error: 'Błąd podczas odczytu pliku CSV. Sprawdź format.' },
        { status: 400 }
      );
    }

    const rows = parsed.data as any[];

    const trades = mapGenericCsv(rows);
    const stats = calculateStats(trades);

    return NextResponse.json(
      {
        success: true,
        stats,
        trades, // możesz to usunąć, jeśli front nie potrzebuje pojedynczych transakcji
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
