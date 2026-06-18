import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from './ThemeToggle';
import '../styles/navbar.css';

// Public-page header only (Landing, Login, Register).
// Authenticated navigation lives in Sidebar.
export default function NavBar() {
  const { token } = useAuth();

  return (
    <header className="navbar">
      <Link to={token ? '/feed' : '/'} className="navbar__logo">Pulse</Link>
      <div className="navbar__actions">
        <ThemeToggle />
        {!token && (
          <>
            <Link to="/login" className="navbar__btn">Log in</Link>
            <Link to="/register" className="navbar__btn navbar__btn--primary">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
