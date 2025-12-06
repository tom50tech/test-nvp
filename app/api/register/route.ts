import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email i hasło są wymagane." },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(email);

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          "Set-Cookie": `user=${encoded}; Path=/; HttpOnly; SameSite=Lax`
        }
      }
    );
  } catch {
    return NextResponse.json(
      { message: "Nieprawidłowe dane wejściowe." },
      { status: 400 }
    );
  }
}
