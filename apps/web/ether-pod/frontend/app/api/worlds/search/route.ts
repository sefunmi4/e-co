import { NextResponse } from 'next/server';
import { searchWorldCards } from '@backend/lib/ethosGateway';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const limit = Number(url.searchParams.get('limit') ?? '6');
  try {
    const results = await searchWorldCards(query, Number.isNaN(limit) ? 6 : limit);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
