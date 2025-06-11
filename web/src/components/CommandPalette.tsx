import React, { useEffect, useState } from 'react';
import { dispatch, Command } from '../../../runtime/src/commands';

const presets: { name: string; cmd: Command }[] = [
  { name: 'Open Terminal', cmd: { type: 'open-terminal' } },
  { name: 'Launch Notes', cmd: { type: 'launch-notes' } },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(presets);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setResults(
      presets.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query]);

  const startVoice = () => {
    const AnyWindow: any = window as any;
    const Rec = AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript;
      setQuery(text);
    };
    rec.start();
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-start justify-center">
      <div className="mt-40 bg-white p-4 rounded shadow w-80">
        <input
          autoFocus
          className="w-full border p-1 mb-2"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="text-sm text-blue-600 mb-2" onClick={startVoice}>
          Voice
        </button>
        <ul>
          {results.map((p) => (
            <li key={p.name}>
              <button
                className="w-full text-left hover:bg-gray-100 px-2 py-1"
                onClick={() => {
                  dispatch(p.cmd);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="text-gray-500 px-2">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
