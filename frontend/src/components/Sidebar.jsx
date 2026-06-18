import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, BookMarked, User, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from './ThemeToggle';
import '../styles/sidebar.css';

const NAV = [
  { to: '/feed',    Icon: LayoutDashboard, label: 'Feed' },
  { to: '/stats',   Icon: BarChart3,       label: 'Stats' },
  { to: '/library', Icon: BookMarked,       label: 'Library' },
  { to: '/profile', Icon: User,             label: 'Profile' },
];

function navClass({ isActive }) {
  return 'sidebar__link' + (isActive ? ' sidebar__link--active' : '');
}

function tabClass({ isActive }) {
  return 'tab-bar__item' + (isActive ? ' tab-bar__item--active' : '');
}

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <>
      {/* ── Desktop / tablet: fixed left sidebar ── */}
      <aside className="sidebar">
        <Link to="/feed" className="sidebar__logo" aria-label="Pulse home">
          Pulse
        </Link>

        <nav className="sidebar__nav" aria-label="Main navigation">
          {NAV.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <ThemeToggle />
          <button className="sidebar__logout" onClick={handleLogout}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile: bottom tab bar ── */}
      <nav className="tab-bar" aria-label="Main navigation">
        {NAV.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} className={tabClass}>
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
            <span className="tab-bar__label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
