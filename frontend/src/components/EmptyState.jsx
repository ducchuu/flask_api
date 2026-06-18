import { Inbox } from 'lucide-react';

export default function EmptyState({ heading, body }) {
  return (
    <div className="empty-state">
      <Inbox className="empty-state__icon" size={40} strokeWidth={1.25} />
      <h3 className="empty-state__heading">{heading ?? 'No items found'}</h3>
      {body && <p className="empty-state__body">{body}</p>}
    </div>
  );
}
