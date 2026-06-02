import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user:        null,
  isLoading:   true,
  isLoggedIn:  false,

  // ── Initialize from stored token ─────────────────────
  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { set({ isLoading: false }); return; }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, isLoggedIn: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },

  // ── Login ────────────────────────────────────────────
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isLoggedIn: true });
    return user;
  },

  // ── Register ─────────────────────────────────────────
  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    const { user, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isLoggedIn: true });
    return user;
  },

  // ── Logout ────────────────────────────────────────────
  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isLoggedIn: false });
  },
}));

export default useAuthStore;
