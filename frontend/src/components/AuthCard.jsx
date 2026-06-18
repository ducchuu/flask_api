import '../styles/auth.css';

export default function AuthCard({ title, footer, children }) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1 className="auth-card__title">{title}</h1>
        {children}
        {footer && <div className="auth-card__footer">{footer}</div>}
      </div>
    </div>
  );
}
