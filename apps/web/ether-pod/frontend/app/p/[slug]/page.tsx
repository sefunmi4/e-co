import { notFound } from 'next/navigation';
import SnapshotSceneHydrator from '@frontend/components/SnapshotSceneHydrator';
import ProceduralBackground from '@frontend/components/ProceduralBackground';
import { fetchSnapshotExperience } from '@backend/lib/pods';

interface PageProps {
  params: { slug: string };
}

export const revalidate = 60;

export default async function PublishedPodPage({ params }: PageProps) {
  const { slug } = params;
  if (!slug) {
    notFound();
  }

  const experience = await fetchSnapshotExperience(slug);
  if (!experience) {
    notFound();
  }

  const {
    snapshot: { pod },
    manifest,
    tour,
  } = experience;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-indigo-100">
      <ProceduralBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
        <header className="max-w-2xl text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">Published Pod</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{pod.title}</h1>
          {pod.description && (
            <p className="text-sm text-indigo-200/80">{pod.description}</p>
          )}
        </header>
        <SnapshotSceneHydrator slug={slug} manifest={manifest} tour={tour ?? undefined} />
      </div>
    </div>
  );
}

