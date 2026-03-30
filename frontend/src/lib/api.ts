import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API methods
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const campaignsApi = {
  list: (params?: { page?: number; per_page?: number; status?: string }) =>
    api.get('/admin/campaigns', { params }),
  get: (id: string) => api.get(`/admin/campaigns/${id}`),
  create: (data: any) => api.post('/admin/campaigns', data),
  update: (id: string, data: any) => api.put(`/admin/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/admin/campaigns/${id}`),
};

export const offersApi = {
  list: (params?: { page?: number; per_page?: number; campaign_id?: string }) =>
    api.get('/admin/offers', { params }),
  get: (id: string) => api.get(`/admin/offers/${id}`),
  create: (data: any) => api.post('/admin/offers', data),
  update: (id: string, data: any) => api.put(`/admin/offers/${id}`, data),
  delete: (id: string) => api.delete(`/admin/offers/${id}`),
};

export const reportsApi = {
  overview: (params: { start_date: string; end_date: string }) =>
    api.get('/report/overview', { params }),
  byCampaign: (params: { start_date: string; end_date: string }) =>
    api.get('/report/by-campaign', { params }),
  byOffer: (params: { start_date: string; end_date: string }) =>
    api.get('/report/by-offer', { params }),
  byDate: (params: { start_date: string; end_date: string }) =>
    api.get('/report/by-date', { params }),
  byCountry: (params: { start_date: string; end_date: string }) =>
    api.get('/report/by-country', { params }),
  export: (params: { start_date: string; end_date: string }) =>
    api.get('/report/export', { params, responseType: 'blob' }),
};
