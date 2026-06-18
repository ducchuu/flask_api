import { Link } from 'react-router-dom';
import { Layers, BarChart3, Link2, SlidersHorizontal } from 'lucide-react';
import NavBar from '../components/NavBar';
import '../styles/landing.css';

const FEATURES = [
  {
    icon: Layers,
    color: 'coral',
    title: 'Multi-source aggregation',
    body: 'News articles, YouTube videos, and forum discussions pulled from across the web — ranked and deduplicated in one unified feed.',
  },
  {
    icon: BarChart3,
    color: 'teal',
    title: 'Transparent scoring',
    body: "Every item shows exactly why it ranked where it did. Interest match, recency, popularity, source quality — no black box, just numbers.",
  },
  {
    icon: Link2,
    color: 'blue',
    title: 'Story clustering',
    body: 'Related coverage of the same event is grouped into a single story arc so you can follow a topic across sources without repetition.',
  },
  {
    icon: SlidersHorizontal,
    color: 'purple',
    title: 'Personal interests',
    body: 'Define your own interests with keywords and tune the scoring weights. Pulse learns your preferences and surfaces what matters to you.',
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <NavBar />

      <main>
        <section className="hero">
          <div className="hero__content">
            <h1 className="hero__headline">Stay ahead of every story.</h1>
            <p className="hero__sub">
              Pulse aggregates news, video, and discussion from across the web —
              scored, clustered, and tuned to what you actually care about.
            </p>
            <div className="hero__actions">
              <Link to="/register" className="hero__cta">Start for free</Link>
              <Link to="/login" className="hero__cta--ghost">Log in</Link>
            </div>
          </div>
        </section>

        {/* Opaque wrapper so the features grid sits on top of the fixed particle layer */}
        <div className="features-wrapper">
          <section className="features">
            <p className="features__label">What Pulse does differently</p>
            <div className="feature-grid">
              {FEATURES.map(({ icon: Icon, color, title, body }) => (
                <div key={title} className="feature-card">
                  <div className={`feature-card__icon feature-card__icon--${color}`}>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="feature-card__title">{title}</h3>
                    <p className="feature-card__body">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="landing-footer">
        Pulse — VU Amsterdam · Applied Programming for AI 2026 · Group 28
      </footer>
    </div>
  );
}
