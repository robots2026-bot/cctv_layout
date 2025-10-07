import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10000
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 请求失败', error);
    return Promise.reject(error);
  }
);
