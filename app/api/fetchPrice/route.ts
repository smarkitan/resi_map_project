import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const name = searchParams.get("name");
  if (!address || !name) {
    return NextResponse.json({ error: "Missing address or name parameter" }, { status: 400 });
  }

  const baseUrl = `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("host")}`;
  const saleUrl = `${baseUrl}/api/fetchSale?name=${encodeURIComponent(name)}`;
  const rentUrl = `${baseUrl}/api/fetchRent?name=${encodeURIComponent(name)}`;

  try {
    const [saleRes, rentRes] = await Promise.all([
      fetch(saleUrl).then((r) => r.json()),
      fetch(rentUrl).then((r) => r.json())
    ]);

    return NextResponse.json({
      sale: saleRes.sale || [],
      rent: rentRes.rent || [],
    });
  } catch (error) {
    return NextResponse.json({
      sale: [],
      rent: [],
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
