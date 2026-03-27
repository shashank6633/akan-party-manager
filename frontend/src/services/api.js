import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('akan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('akan_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const partyAPI = {
  getAll: (params) => api.get('/parties', { params }),
  lookup: (uniqueId) => api.get(`/parties/lookup/${encodeURIComponent(uniqueId)}`),
  getStats: (params) => api.get('/parties/stats', { params }),
  getById: (id) => api.get(`/parties/${id}`),
  create: (data) => api.post('/parties', data),
  update: (id, data) => api.put(`/parties/${id}`, data),
  delete: (id) => api.delete(`/parties/${id}`),
  updateStatus: (id, statusData) => api.put(`/parties/${id}/status`, statusData),
  addPayment: (id, paymentData) => api.put(`/parties/${id}/payment`, paymentData),
  getPayments: (id) => api.get(`/parties/${id}/payments`),
  addFollowUp: (id, data) => api.put(`/parties/${id}/followup`, data),
  getPendingFollowUps: () => api.get('/parties/pending-followups'),
  sendPaymentReminder: (id) => api.post(`/parties/${id}/send-payment-reminder`),
  getReminderLog: () => api.get('/parties/reminder-log'),
};

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/register', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getStaleEnquiries: () => api.get('/notifications/stale-enquiries'),
  getEmailSettings: () => api.get('/notifications/email-settings'),
  updateEmailSettings: (data) => api.put('/notifications/email-settings', data),
};

export const reportAPI = {
  getDaily: (date) => api.get('/reports/daily', { params: { date } }),
  getRange: (from, to) => api.get('/reports/range', { params: { from, to } }),
  exportData: (params) => api.get('/reports/export', { params, responseType: 'blob' }),
  sendDaily: () => api.post('/reports/send-daily'),
  sendRange: (from, to, label) => api.post('/reports/send-range', { from, to, label }),
};
