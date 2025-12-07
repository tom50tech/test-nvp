// Typ wewnętrzny – na nim potem liczysz statystyki
export type NormalizedTrade = {
  date: string;
  instrument: string;
  type: string;              // 'BUY' / 'SELL' / itp.
  volume?: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
};

// Alias nagłówków – PL + EN + typowe warianty
const COLUMN_ALIASES = {
  date:       ['date', 'data', 'open time', 'open_time', 'czas otwarcia'],
  instrument: ['instrument', 'symbol', 'market', 'rynek'],
  type:       ['type', 'typ', 'side', 'direction', 'kierunek'],
  volume:     ['volume', 'wolumen', 'size', 'ilosc'],
  entryPrice: ['entry price', 'entry_price', 'cena wejścia', 'cena_wejscia', 'open', 'open price'],
  exitPrice:  ['exit price', 'exit_price', 'cena wyjścia', 'cena_wyjscia', 'close', 'close price'],
  profit:     ['profit', 'p/l', 'p&l', 'wynik', 'zysk/strata', 'zysk', 'strata'],
};

function normalizeHeader(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')                  // usuń ogonki
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');        // usuń spacje, kropki itp.
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const match = normalizedHeaders.find(h => h.normalized === normAlias);
    if (match) return match.original;
  }
  return null;
}

// Główna funkcja normalizująca dowolny CSV do Twojego formatu
export function mapGenericCsv(rows: any[]): NormalizedTrade[] {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);

  const dateCol       = findColumn(headers, COLUMN_ALIASES.date);
  const instrumentCol = findColumn(headers, COLUMN_ALIASES.instrument);
  const typeCol       = findColumn(headers, COLUMN_ALIASES.type);
  const volumeCol     = findColumn(headers, COLUMN_ALIASES.volume);
  const entryCol      = findColumn(headers, COLUMN_ALIASES.entryPrice);
  const exitCol       = findColumn(headers, COLUMN_ALIASES.exitPrice);
  const profitCol     = findColumn(headers, COLUMN_ALIASES.profit);

  // Twarda walidacja – ale już „mądra”, nie po jednym stringu
  if (!dateCol || !instrumentCol || !typeCol || (!profitCol && (!entryCol || !exitCol))) {
    throw new Error(
      'Nie udało się dopasować wymaganych kolumn. ' +
      'Po prostu wyeksportuj historię transakcji z brokera i wgraj plik bez zmian.'
    );
  }

  return rows.map((row) => {
    const rawType = String(row[typeCol!]).toLowerCase();

    const typeNorm =
      rawType.startsWith('b') || rawType.includes('kup') ? 'BUY' :
      rawType.startsWith('s') || rawType.includes('sprz') ? 'SELL' :
      rawType.toUpperCase();

    const volume   = volumeCol ? Number(row[volumeCol]) : undefined;

    let entryPrice: number | undefined;
    let exitPrice: number | undefined;
    let profit: number | undefined;

    if (profitCol && row[profitCol] !== undefined && row[profitCol] !== '') {
      profit = Number(String(row[profitCol]).replace(',', '.'));
    } else {
      if (entryCol && row[entryCol] !== undefined) {
        entryPrice = Number(String(row[entryCol]).replace(',', '.'));
      }
      if (exitCol && row[exitCol] !== undefined) {
        exitPrice = Number(String(row[exitCol]).replace(',', '.'));
      }
      if (entryPrice !== undefined && exitPrice !== undefined) {
        profit = typeNorm === 'BUY'
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;
      }
    }

    return {
      date: String(row[dateCol!]),
      instrument: String(row[instrumentCol!]),
      type: typeNorm,
      volume,
      entryPrice,
      exitPrice,
      profit,
    };
  });
}
