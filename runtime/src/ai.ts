export type InferenceMode = 'local' | 'online';

let mode: InferenceMode = 'local';

export function setInferenceMode(m: InferenceMode) {
  mode = m;
}

export function getInferenceMode(): InferenceMode {
  return mode;
}

export interface Model {
  id: string;
  name: string;
  status: 'running' | 'stopped';
}

const models: Model[] = [];

export function listModels(): Model[] {
  return [...models];
}

export function addModel(model: Model) {
  models.push(model);
}

export function updateModel(id: string, partial: Partial<Model>) {
  const m = models.find((x) => x.id === id);
  if (m) Object.assign(m, partial);
}
