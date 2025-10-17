import { useMemo, useState } from 'react';
import { WorldPreview } from './components/WorldPreview';
import { ArtifactGallery } from './components/ArtifactGallery';
import { VisitorsPanel } from './components/VisitorsPanel';
import { Search, Globe2 } from 'lucide-react';

const sampleArtifacts = [
  {
    id: 'artifact-1',
    name: 'Aurora Synthwave Tee',
    description: 'Dynamic fabric shader mapped to your latest Ethos design repo.',
    visibility: 'private' as const,
    tags: ['apparel', '3d-print', 'ethos'],
  },
  {
    id: 'artifact-2',
    name: 'Zero-G Controller',
    description: 'Interactable haptic prototype exported from ether-pod playtests.',
    visibility: 'friends' as const,
    tags: ['hardware', 'prototype'],
  },
  {
    id: 'artifact-3',
    name: 'Parisian Boutique Experience',
    description: 'Teleport-ready scene blending pod-world assets with live merch feeds.',
    visibility: 'public' as const,
    tags: ['environment', 'retail', 'vr'],
  },
];

function App() {
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'friends' | 'public'>('all');

  const filteredArtifacts = useMemo(() => {
    return sampleArtifacts.filter((artifact) => {
      const matchesQuery = artifact.name.toLowerCase().includes(query.toLowerCase());
      const matchesVisibility = visibilityFilter === 'all' || artifact.visibility === visibilityFilter;
      return matchesQuery && matchesVisibility;
    });
  }, [query, visibilityFilter]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar__header">
          <Globe2 size={24} />
          <div>
            <h1>Ether Net</h1>
            <p>Your personal gateway between pod worlds and the public ether.</p>
          </div>
        </header>

        <div className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artifacts, worlds, or creators"
          />
        </div>

        <div className="visibility-filter" role="radiogroup" aria-label="Visibility filters">
          {['all', 'private', 'friends', 'public'].map((option) => (
            <button
              key={option}
              type="button"
              className={visibilityFilter === option ? 'active' : ''}
              onClick={() => setVisibilityFilter(option as typeof visibilityFilter)}
            >
              {option === 'all' ? 'All Spaces' : `${option.charAt(0).toUpperCase()}${option.slice(1)} only`}
            </button>
          ))}
        </div>

        <ArtifactGallery artifacts={filteredArtifacts} />
      </aside>

      <main className="stage">
        <WorldPreview />
        <VisitorsPanel />
      </main>
    </div>
  );
}

export default App;
