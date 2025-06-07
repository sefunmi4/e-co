import React, { useEffect, useState } from 'react';

interface Environment {
  id: string;
  name: string;
  background: string;
}

const ENV_KEY = 'etheros.currentEnv';

export default function EnvManager() {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [current, setCurrent] = useState<string>(() =>
    localStorage.getItem(ENV_KEY) || ''
  );

  useEffect(() => {
    fetch('/environments.json')
      .then((res) => res.json())
      .then((data) => setEnvs(data));
  }, []);

  const switchEnv = (id: string, bg: string) => {
    setCurrent(id);
    localStorage.setItem(ENV_KEY, id);
    document.body.style.backgroundImage = `url(${bg})`;
    document.body.style.backgroundSize = 'cover';
  };

  return (
    <div className="absolute top-4 left-4 bg-white bg-opacity-80 p-2 rounded shadow">
      <h2 className="font-bold mb-1">Environments</h2>
      <ul className="flex gap-2">
        {envs.map((env) => (
          <li key={env.id}>
            <button
              className={`px-2 py-1 rounded ${
                current === env.id ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => switchEnv(env.id, env.background)}
            >
              {env.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
