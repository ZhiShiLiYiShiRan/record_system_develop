// frontend/src/services/api.ts

import axios from 'axios';

// 1. 从 .env 里读取后端地址
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

// 2. 创建 axios 实例，所有请求都以 baseURL 为基础
const api = axios.create({
  baseURL,
  withCredentials: true,        // 如果后端需要携带 cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// 3. 拦截器：自动把 localStorage 里的 token 放入 Authorization 头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
