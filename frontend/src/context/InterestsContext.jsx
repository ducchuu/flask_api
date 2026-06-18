import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const InterestsCtx = createContext([[], () => {}]);

export function InterestsProvider({ children }) {
  const [interests, setInterests] = useState([]);

  const refresh = useCallback(() => {
    api.get('/api/interests').then(setInterests).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <InterestsCtx.Provider value={[interests, refresh]}>
      {children}
    </InterestsCtx.Provider>
  );
}

export function useInterests() {
  return useContext(InterestsCtx);
}
