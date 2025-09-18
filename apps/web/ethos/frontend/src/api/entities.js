import { request } from './client';

export const Quest = {
  list: () => request('/api/quests'),
  filter: (params = {}) => request(`/api/quests${buildQuery(params)}`),
  create: (data) => request('/api/quests', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/quests/${id}`),
  update: (id, data) => request(`/api/quests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/quests/${id}`, { method: 'DELETE' })
};

export const Guild = {
  list: () => request('/api/guilds'),
  create: (data) => request('/api/guilds', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/guilds/${id}`),
  update: (id, data) => request(`/api/guilds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/guilds/${id}`, { method: 'DELETE' })
};

export const GuildMembership = {
  create: (data) => request('/api/guild_memberships', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}) => request(`/api/guild_memberships${buildQuery(params)}`),
  approve: (id, data = {}) => request(`/api/guild_memberships/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/guild_memberships/${id}`, { method: 'DELETE' })
};

export const QuestLog = {
  list: () => request('/api/quest_logs'),
  create: (data) => request('/api/quest_logs', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/quest_logs/${id}`),
  update: (id, data) => request(`/api/quest_logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/quest_logs/${id}`, { method: 'DELETE' })
};

function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${query}`;
}

export const QuestLike = {
  create: (data) => request('/api/quest_likes', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/quest_likes/${id}`, { method: 'DELETE' }),
  filter: (params = {}) => request(`/api/quest_likes${buildQuery(params)}`)
};

export const QuestComment = {
  create: (data) => request('/api/quest_comments', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}) => request(`/api/quest_comments${buildQuery(params)}`)
};

export const TeamApplication = {
  create: (data) => request('/api/team_applications', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}) => request(`/api/team_applications${buildQuery(params)}`),
  update: (id, data) => request(`/api/team_applications/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};
