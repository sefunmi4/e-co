import { Users, Share2, Lock, Sparkles } from 'lucide-react';

const visitorStats = {
  onlineFriends: 3,
  recentVisitors: [
    { id: 'fox', name: 'foxglove.eth', status: 'in your atelier' },
    { id: 'sol', name: 'solstice.lens', status: 'starred your boutique' },
    { id: 'iz', name: 'izumi.xyz', status: 'tagged a remix' },
  ],
};

export function VisitorsPanel() {
  return (
    <section className="visitors">
      <header>
        <Users size={18} />
        <h3>Presence</h3>
      </header>

      <p className="metric">
        <span>{visitorStats.onlineFriends}</span>
        <span>friends online</span>
      </p>

      <ul className="visitor-list">
        {visitorStats.recentVisitors.map((visitor) => (
          <li key={visitor.id}>
            <span className="avatar" aria-hidden>🛰️</span>
            <div>
              <p className="name">{visitor.name}</p>
              <p className="status">{visitor.status}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="sharing">
        <h4>Sharing controls</h4>
        <button type="button" className="share-button">
          <Share2 size={16} /> Invite friends to teleport
        </button>
        <button type="button" className="share-button secondary">
          <Lock size={16} /> Toggle private mode
        </button>
        <button type="button" className="share-button tertiary">
          <Sparkles size={16} /> Publish to global directory
        </button>
      </div>
    </section>
  );
}
