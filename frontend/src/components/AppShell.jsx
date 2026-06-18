import Sidebar from './Sidebar';
import { InterestsProvider } from '../context/InterestsContext';

export default function AppShell({ children }) {
  return (
    <InterestsProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-shell__main">
          {children}
        </main>
      </div>
    </InterestsProvider>
  );
}
