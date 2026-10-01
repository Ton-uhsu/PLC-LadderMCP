import { ApiError, type ProjectApi } from './workspace';
export function projectApi(context: () => { apiUrl: string; apiToken: string }): ProjectApi {
  async function request(path: string, body?: unknown) {
    const { apiUrl, apiToken } = context();
    const res = await fetch(`${apiUrl}/api/persistence/projects${path}`, { method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) { const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` })); throw new ApiError(res.status, error.error); }
    return res.json();
  }
  return { list: () => request(''), read: id => request(`/${id}`), create: snapshot => request('', { snapshot }),
    save: (id, body) => request(`/${id}`, body) };
}
