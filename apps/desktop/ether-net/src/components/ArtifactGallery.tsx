import { Fragment } from 'react';

export type ArtifactVisibility = 'private' | 'friends' | 'public';

export interface Artifact {
  id: string;
  name: string;
  description: string;
  visibility: ArtifactVisibility;
  tags: string[];
}

interface ArtifactGalleryProps {
  artifacts: Artifact[];
}

const VISIBILITY_LABELS: Record<ArtifactVisibility, string> = {
  private: 'Only you',
  friends: 'Friends-only',
  public: 'Shared to Ether Net',
};

export function ArtifactGallery({ artifacts }: ArtifactGalleryProps) {
  if (artifacts.length === 0) {
    return (
      <div className="gallery gallery--empty">
        <p>No artifacts match your filters yet.</p>
        <p className="hint">Toggle visibility or create a new space from your Ethos repo to populate the scene.</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      {artifacts.map((artifact) => (
        <Fragment key={artifact.id}>
          <article className={`artifact artifact--${artifact.visibility}`}>
            <header>
              <span className="badge">{VISIBILITY_LABELS[artifact.visibility]}</span>
              <h2>{artifact.name}</h2>
            </header>
            <p>{artifact.description}</p>
            <ul className="tags">
              {artifact.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <button type="button" className="cta">Open curator tools</button>
          </article>
        </Fragment>
      ))}
    </div>
  );
}
