export interface TradeRow {
  data: string;
  instrument: string;
  typ: string;
  wolumen: number;
  cena_wejscia: number;
  cena_wyjscia: number;
  wynik: number;
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgProfit: number;
  avgLoss: number;
}
