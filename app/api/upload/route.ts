import { NextRequest, NextResponse } from "next/server";
import { parseCsv, calculateStats } from "@/lib/stats";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "Brak pliku CSV." },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Nie udało się odczytać żadnych transakcji." },
        { status: 400 }
      );
    }

    const stats = calculateStats(rows);

    return NextResponse.json(
      {
        stats,
        rows
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { message: "Błąd podczas przetwarzania pliku CSV." },
      { status: 500 }
    );
  }
}
