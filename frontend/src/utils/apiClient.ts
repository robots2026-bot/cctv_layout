import axios from 'axios';

const inferDefaultBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return '/api';
};

export const apiClient = axios.create({
  baseURL: inferDefaultBaseUrl(),
  timeout: 10000
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 请求失败', error);
    return Promise.reject(error);
  }
);
