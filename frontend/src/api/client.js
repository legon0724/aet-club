import axios from 'axios';

const api = axios.create({
  baseURL: 'https://web-production-00104.up.railway.app',
  timeout: 15000,
});

const GET_CACHE_TTL = 8000;
const getCache = new Map();
const pendingGets = new Map();
let cacheGeneration = 0;

function getCacheKey(url, config = {}) {
  const token = localStorage.getItem('token') || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${token}|${url}|${params}`;
}

export function clearApiCache() {
  cacheGeneration += 1;
  getCache.clear();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const axiosGet = api.get.bind(api);
api.get = (url, config = {}) => {
  if (config.cache === false || config.responseType) return axiosGet(url, config);

  const key = getCacheKey(url, config);
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
  if (pendingGets.has(key)) return pendingGets.get(key);

  const generation = cacheGeneration;
  const request = axiosGet(url, config)
    .then((response) => {
      if (generation === cacheGeneration) {
        getCache.set(key, { response, expiresAt: Date.now() + GET_CACHE_TTL });
      }
      return response;
    })
    .finally(() => pendingGets.delete(key));
  pendingGets.set(key, request);
  return request;
};

['post', 'put', 'patch', 'delete'].forEach((method) => {
  const request = api[method].bind(api);
  api[method] = (...args) => {
    clearApiCache();
    return request(...args);
  };
});

export default api;
