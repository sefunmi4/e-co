"use client";

import type { ComponentType } from 'react';
import React, { useEffect, useState } from 'react';
import { info, error } from '@eco/js-sdk/logger';
import Window from './Window';
import ProceduralBackground from './ProceduralBackground';

interface Environment {
  id: string;
  name: string;
  background?: string;
  module?: string;
}

const ENV_KEY = 'etheros.currentEnv';

interface Props {
  onWorldChange?: (comp: ComponentType | null) => void;
}

export default function EnvManager({ onWorldChange }: Props) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [current, setCurrent] = useState<string>(() =>
    localStorage.getItem(ENV_KEY) || ''
  );

  useEffect(() => {
    info('Fetching environments');
    fetch('/environments.json')
      .then((res) => res.json())
      .then((data) => {
        info('Loaded environments', data);
        setEnvs(data);
      })
      .catch((err) => error('Failed to load environments', err));
  }, []);

  const switchEnv = async (env: Environment) => {
    setCurrent(env.id);
    localStorage.setItem(ENV_KEY, env.id);

    if (env.background) {
      document.body.style.backgroundImage = `url(${env.background})`;
      document.body.style.backgroundSize = 'cover';
    } else {
      document.body.style.backgroundImage = '';
    }

    if (onWorldChange) {
      if (env.module === 'procedural-background') {
        onWorldChange(() => ProceduralBackground);
      } else if (env.module) {
        try {
          const mod = await import(/* webpackIgnore: true */ env.module);
          onWorldChange(mod.default);
        } catch (e) {
          error('Failed to load world module', e);
          onWorldChange(null);
        }
      } else {
        onWorldChange(null);
      }
    }

    info(`Switched environment to ${env.id}`);
  };

  return (
    <Window className="top-4 left-4 bg-white bg-opacity-80 p-2 rounded shadow">
      <h2 className="font-bold mb-1">Environments</h2>
      <ul className="flex gap-2">
        {envs.map((env) => (
          <li key={env.id}>
            <button
              className={`px-2 py-1 rounded ${
                current === env.id ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => switchEnv(env)}
            >
              {env.name}
            </button>
          </li>
        ))}
      </ul>
    </Window>
  );
}
