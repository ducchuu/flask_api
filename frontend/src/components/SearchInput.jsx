import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function SearchInput({ onChange }) {
  const [value, setValue] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount so an empty-string onChange doesn't cause a spurious refetch
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => onChange(value), 400);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="search-wrap">
      <Search className="search-wrap__icon" size={16} />
      <input
        type="search"
        className="search-input"
        placeholder="Search across your feed…"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  );
}
