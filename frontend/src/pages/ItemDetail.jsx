import { Navigate } from 'react-router-dom';
// Route /items/:id is now handled by Feed (split-view layout).
// This file is kept as a safe fallback in case of a direct import elsewhere.
export default function ItemDetail() {
  return <Navigate to="/feed" replace />;
}
