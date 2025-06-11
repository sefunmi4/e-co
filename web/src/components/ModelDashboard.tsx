import React, { useState } from 'react';
import { addModel, listModels, updateModel, Model } from '../../../runtime/src/ai';

export default function ModelDashboard() {
  const [models, setModels] = useState<Model[]>(listModels());
  const [name, setName] = useState('');

  const add = () => {
    const m: Model = { id: `${Date.now()}`, name, status: 'stopped' };
    addModel(m);
    setModels(listModels());
    setName('');
  };

  const toggle = (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return;
    const newStatus = m.status === 'running' ? 'stopped' : 'running';
    updateModel(id, { status: newStatus });
    setModels(listModels());
  };

  return (
    <div className="absolute top-4 right-4 bg-white bg-opacity-80 p-2 rounded shadow w-64">
      <h2 className="font-bold mb-1">Models</h2>
      <div className="flex mb-2">
        <input
          className="border flex-1 mr-1 px-1"
          placeholder="Model name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="bg-blue-500 text-white px-2" onClick={add}>
          Add
        </button>
      </div>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {models.map((m) => (
          <li key={m.id} className="flex justify-between items-center">
            <span>{m.name}</span>
            <button className="text-sm text-blue-600" onClick={() => toggle(m.id)}>
              {m.status === 'running' ? 'Stop' : 'Start'}
            </button>
          </li>
        ))}
        {models.length === 0 && <li className="text-gray-500">No models</li>}
      </ul>
    </div>
  );
}
