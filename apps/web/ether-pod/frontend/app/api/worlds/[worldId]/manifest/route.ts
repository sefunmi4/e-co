import { NextResponse } from 'next/server';
import { readEcoManifest } from '@backend/lib/ethosGateway';

interface Params {
  params: {
    worldId: string;
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const manifest = await readEcoManifest(params.worldId);
    return NextResponse.json(manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
