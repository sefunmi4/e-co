import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { fetchSnapshotExperience } from '@backend/lib/pods';

export const runtime = 'edge';
export const revalidate = 60 * 60; // Revalidate once per hour

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const roundAngle = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}°`;
};

const formatAngleValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundAngle(value);
  }
  if (Array.isArray(value)) {
    const formatted = value
      .map((entry) => formatAngleValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    if (formatted.length > 0) {
      return formatted.join(' · ');
    }
    return null;
  }
  if (isRecord(value)) {
    const axisEntries: string[] = [];
    const axes: Array<[string, unknown]> = [
      ['yaw', value.yaw],
      ['pitch', value.pitch],
      ['roll', value.roll],
      ['x', value.x],
      ['y', value.y],
      ['z', value.z],
    ];
    for (const [label, candidate] of axes) {
      if (candidate == null) continue;
      const formatted = formatAngleValue(candidate);
      if (formatted) {
        axisEntries.push(`${label.toUpperCase()}: ${formatted}`);
      }
    }
    if (axisEntries.length > 0) {
      return axisEntries.join(' · ');
    }

    const nestedKeys = [
      'angle',
      'value',
      'rotation',
      'heroAngle',
      'hero_angle',
      'heading',
    ];
    for (const key of nestedKeys) {
      const nested = value[key];
      if (nested == null) continue;
      const formatted = formatAngleValue(nested);
      if (formatted) {
        return formatted;
      }
    }
  }
  return null;
};

const findValueAtPath = (
  record: Record<string, unknown>,
  path: string[],
): unknown => {
  let cursor: unknown = record;
  for (const segment of path) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
    if (cursor == null) {
      return undefined;
    }
  }
  return cursor;
};

const searchForAngle = (value: unknown, depth = 0): string | null => {
  if (depth > 4) {
    return null;
  }
  if (value == null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return formatAngleValue(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const formatted = searchForAngle(entry, depth + 1);
      if (formatted) {
        return formatted;
      }
    }
    return null;
  }
  if (isRecord(value)) {
    for (const [key, candidate] of Object.entries(value)) {
      if (/angle|rotation|heading/i.test(key)) {
        const formatted = formatAngleValue(candidate);
        if (formatted) {
          return formatted;
        }
      }
    }
    for (const candidate of Object.values(value)) {
      const formatted = searchForAngle(candidate, depth + 1);
      if (formatted) {
        return formatted;
      }
    }
  }
  return null;
};

const resolveHeroAngle = (
  manifest: Record<string, unknown>,
  snapshot: { items: Array<{ item_type: string; item_data: unknown }> },
): string => {
  const paths: string[][] = [
    ['rendering', 'heroAngle'],
    ['rendering', 'hero', 'angle'],
    ['rendering', 'hero', 'rotation'],
    ['rendering', 'camera', 'heroAngle'],
    ['rendering', 'camera', 'hero', 'angle'],
    ['meta', 'heroAngle'],
    ['meta', 'camera', 'heroAngle'],
  ];

  for (const path of paths) {
    const value = findValueAtPath(manifest, path);
    const formatted = formatAngleValue(value);
    if (formatted) {
      return formatted;
    }
  }

  const manifestAngle = searchForAngle(manifest);
  if (manifestAngle) {
    return manifestAngle;
  }

  for (const item of snapshot.items) {
    if (!item?.item_type) continue;
    if (!/hero|camera/i.test(item.item_type)) {
      continue;
    }
    const formatted = formatAngleValue(item.item_data) ?? searchForAngle(item.item_data);
    if (formatted) {
      return formatted;
    }
  }

  return 'Signature view';
};

const buildCard = ({
  title,
  slug,
  heroAngle,
}: {
  title: string;
  slug: string;
  heroAngle: string;
}) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px',
      background: 'radial-gradient(circle at top left, #312e81, #0f172a 55%, #020617 100%)',
      color: '#e0e7ff',
      fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div
        style={{
          fontSize: 32,
          letterSpacing: 8,
          textTransform: 'uppercase',
          fontWeight: 600,
          color: '#a5b4fc',
        }}
      >
        Ether Pods
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: '#c7d2fe',
        }}
      >
        /p/{slug}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          fontSize: 80,
          fontWeight: 700,
          lineHeight: 1.1,
          color: '#ffffff',
          textShadow: '0 24px 48px rgba(15, 23, 42, 0.65)',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: '#818cf8' }}>
          Hero Angle
        </div>
        <div style={{ fontSize: 46, fontWeight: 600, color: '#f8fafc' }}>{heroAngle}</div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#94a3b8' }}>
      <div style={{ fontSize: 24, letterSpacing: 3 }}>eco.com</div>
      <div style={{ fontSize: 20 }}>Snapshot powered by Eco Indexer</div>
    </div>
  </div>
);

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug?: string } },
) {
  const slug = params?.slug;
  if (!slug) {
    return new Response('Missing pod slug', { status: 400 });
  }

  try {
    const experience = await fetchSnapshotExperience(slug);
    if (!experience) {
      return new Response('Pod snapshot not found', { status: 404 });
    }

    const {
      snapshot: { pod, items },
      manifest,
    } = experience;

    const title = pod.title ?? slug;
    const heroAngle = resolveHeroAngle(manifest as Record<string, unknown>, { items });

    return new ImageResponse(buildCard({ title, slug, heroAngle }), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      headers: {
        'Cache-Control': 'public, immutable, no-transform, s-maxage=604800, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Failed to render pod OG image', error);
    return new Response('Failed to render pod OG image', { status: 500 });
  }
}
