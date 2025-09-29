import { request, logout as apiLogout } from './client';

const defaultOptions = (sort, limit, page) => ({ sort, limit, page });

function buildQuery(params = {}, options = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (typeof value === 'object') {
      searchParams.set(key, JSON.stringify(value));
    } else {
      searchParams.set(key, String(value));
    }
  });

  if (options.sort) {
    searchParams.set('sort', options.sort);
  }
  if (options.limit) {
    searchParams.set('limit', String(options.limit));
  }
  if (options.page) {
    searchParams.set('page', String(options.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const Quest = {
  list: (sort, limit, page) => request(`/api/quests${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/quests${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/quests', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/quests/${id}`),
  update: (id, data) => request(`/api/quests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/quests/${id}`, { method: 'DELETE' }),
  delete: (id) => request(`/api/quests/${id}`, { method: 'DELETE' }),
};

export const Guild = {
  list: (sort, limit, page) => request(`/api/guilds${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/guilds${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/guilds', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/guilds/${id}`),
  update: (id, data) => request(`/api/guilds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/guilds/${id}`, { method: 'DELETE' }),
  delete: (id) => request(`/api/guilds/${id}`, { method: 'DELETE' }),
};

export const GuildMembership = {
  create: (data) => request('/api/guild_memberships', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}, sort, limit, page) => request(`/api/guild_memberships${buildQuery(params, defaultOptions(sort, limit, page))}`),
  approve: (id, data = {}) => request(`/api/guild_memberships/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/guild_memberships/${id}`, { method: 'DELETE' }),
};

export const QuestLog = {
  list: (sort, limit, page) => request(`/api/quest_logs${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/quest_logs${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/quest_logs', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/api/quest_logs/${id}`),
  update: (id, data) => request(`/api/quest_logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/quest_logs/${id}`, { method: 'DELETE' }),
  delete: (id) => request(`/api/quest_logs/${id}`, { method: 'DELETE' }),
};

export const QuestLike = {
  create: (data) => request('/api/quest_likes', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/quest_likes/${id}`, { method: 'DELETE' }),
  filter: (params = {}, sort, limit, page) => request(`/api/quest_likes${buildQuery(params, defaultOptions(sort, limit, page))}`),
};

export const QuestComment = {
  create: (data) => request('/api/quest_comments', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}, sort, limit, page) => request(`/api/quest_comments${buildQuery(params, defaultOptions(sort, limit, page))}`),
};

export const TeamApplication = {
  create: (data) => request('/api/team_applications', { method: 'POST', body: JSON.stringify(data) }),
  filter: (params = {}, sort, limit, page) => request(`/api/team_applications${buildQuery(params, defaultOptions(sort, limit, page))}`),
  update: (id, data) => request(`/api/team_applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const User = {
  list: (sort, limit, page) => request(`/api/users${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/users${buildQuery(params, defaultOptions(sort, limit, page))}`),
  me: () => request('/api/users/me'),
  updateMyUserData: (data) => request('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  logout: async () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/logout';
      return;
    }
    await apiLogout();
  },
};

export const UserFollow = {
  filter: (params = {}, sort, limit, page) => request(`/api/user_follows${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/user_follows', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/user_follows/${id}`, { method: 'DELETE' }),
};

export const Notification = {
  filter: (params = {}, sort, limit, page) => request(`/api/notifications${buildQuery(params, defaultOptions(sort, limit, page))}`),
  update: (id, data) => request(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const Party = {
  list: (sort, limit, page) => request(`/api/parties${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/parties${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/parties', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/parties/${id}`, { method: 'DELETE' }),
};

export const BugReport = {
  list: (sort, limit, page) => request(`/api/bug_reports${buildQuery({}, defaultOptions(sort, limit, page))}`),
  filter: (params = {}, sort, limit, page) => request(`/api/bug_reports${buildQuery(params, defaultOptions(sort, limit, page))}`),
  create: (data) => request('/api/bug_reports', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/bug_reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
