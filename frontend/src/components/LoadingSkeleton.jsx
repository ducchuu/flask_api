export default function LoadingSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line skeleton-line--long" />
      <div className="skeleton-line skeleton-line--full" />
      <div className="skeleton-line skeleton-line--medium" />
      <div className="skeleton-line skeleton-line--full" />
    </div>
  );
}
