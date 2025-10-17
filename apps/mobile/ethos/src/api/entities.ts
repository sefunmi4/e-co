import { request } from './client';

type ListOptions = {
  sort?: string;
  limit?: number;
  page?: number;
};

type Query = Record<string, string | number | boolean | undefined | null>;

const buildQuery = (params: Query = {}, options: ListOptions = {}) => {
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
};

export interface Quest {
  id: string;
  title: string;
  description: string;
  quest_type?: string;
  status?: string;
  priority?: string;
  created_by: string;
  created_date: string;
  visibility?: string;
  is_archived?: boolean;
  guild_id?: string;
  like_count?: number;
  comment_count?: number;
  average_rating?: number;
}

export interface Guild {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
  quest_count?: number;
}

export interface User {
  id: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  username?: string;
  role?: string;
  is_guest?: boolean;
}

export const QuestApi = {
  list: (options: ListOptions = {}) => request<Quest[]>(`/api/quests${buildQuery({}, options)}`),
  filter: (params: Query = {}, sort?: string, limit?: number, page?: number) =>
    request<Quest[]>(`/api/quests${buildQuery(params, { sort, limit, page })}`),
  get: (id: string) => request<Quest>(`/api/quests/${id}`),
};

export const GuildApi = {
  list: (options: ListOptions = {}) => request<Guild[]>(`/api/guilds${buildQuery({}, options)}`),
  filter: (params: Query = {}, sort?: string, limit?: number, page?: number) =>
    request<Guild[]>(`/api/guilds${buildQuery(params, { sort, limit, page })}`),
};

export const UserApi = {
  me: () => request<User>('/api/users/me'),
};
