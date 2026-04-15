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
  getEditHistory: (id) => api.get(`/parties/${id}/edit-history`),
};

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/register', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  toggleUserStatus: (id) => api.put(`/auth/users/${id}/toggle-status`),
  changePassword: (data) => api.put('/auth/change-password', data),
  resetUserPassword: (id, data) => api.put(`/auth/users/${id}/reset-password`, data),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getStaleEnquiries: () => api.get('/notifications/stale-enquiries'),
  getEmailSettings: () => api.get('/notifications/email-settings'),
  updateEmailSettings: (data) => api.put('/notifications/email-settings', data),
  getFpSettings: () => api.get('/notifications/fp-settings'),
  updateFpSettings: (data) => api.put('/notifications/fp-settings', data),
  getEmailRouting: () => api.get('/notifications/email-routing'),
  updateEmailRouting: (data) => api.put('/notifications/email-routing', data),
};

export const fpAPI = {
  getAll: (params) => api.get('/fp', { params }),
  getByParty: (partyUniqueId) => api.get(`/fp/by-party/${encodeURIComponent(partyUniqueId)}`),
  getById: (id) => api.get(`/fp/${id}`),
  create: (data) => api.post('/fp', data),
  update: (id, data) => api.put(`/fp/${id}`, data),
  delete: (id) => api.delete(`/fp/${id}`),
  sendEmail: (id, data) => api.post(`/fp/${id}/send-email`, data),
};

export const feedbackAPI = {
  getAll: (params) => api.get('/feedback', { params }),
  getById: (id) => api.get(`/feedback/${id}`),
  getByFp: (fpId) => api.get(`/feedback/by-fp/${encodeURIComponent(fpId)}`),
  submit: (data) => api.post('/feedback', data),
};

export const preTastingAPI = {
  getAll: (params) => api.get('/pre-tasting', { params }),
  getById: (id) => api.get(`/pre-tasting/${id}`),
  getByFp: (fpId) => api.get(`/pre-tasting/by-fp/${encodeURIComponent(fpId)}`),
  submit: (data) => api.post('/pre-tasting', data),
};

export const guestContactAPI = {
  getAll: (params) => api.get('/guest-contacts', { params }),
  getStats: () => api.get('/guest-contacts/stats'),
  getTasks: () => api.get('/guest-contacts/tasks'),
  getAdminRequests: () => api.get('/guest-contacts/admin-requests'),
  create: (data) => api.post('/guest-contacts', data),
  update: (rowIndex, data) => api.put(`/guest-contacts/${rowIndex}`, data),
  requestNoContacts: (rowIndex, reason) => api.put(`/guest-contacts/no-contacts/${rowIndex}`, { reason }),
  approveNoContacts: (rowIndex) => api.put(`/guest-contacts/approve-no-contacts/${rowIndex}`),
  delete: (rowIndex) => api.delete(`/guest-contacts/${rowIndex}`),
};

export const checkinAPI = {
  getGuests: (partyId) => api.get(`/checkin/${encodeURIComponent(partyId)}/guests`),
  getStats: (partyId) => api.get(`/checkin/${encodeURIComponent(partyId)}/stats`),
  addGuest: (partyId, data) => api.post(`/checkin/${encodeURIComponent(partyId)}/guests`, data),
  addGuestsBulk: (partyId, guests) => api.post(`/checkin/${encodeURIComponent(partyId)}/guests/bulk`, { guests }),
  updateGuest: (partyId, guestId, data) => api.put(`/checkin/${encodeURIComponent(partyId)}/guests/${guestId}`, data),
  deleteGuest: (partyId, guestId) => api.delete(`/checkin/${encodeURIComponent(partyId)}/guests/${guestId}`),
  generateQr: (partyId, guestId) => api.post(`/checkin/${encodeURIComponent(partyId)}/guests/${guestId}/generate-qr`),
  sendInvite: (partyId, guestId, partyDetails) => api.post(`/checkin/${encodeURIComponent(partyId)}/guests/${guestId}/send-invite`, partyDetails),
  bulkInvite: (partyId, partyDetails) => api.post(`/checkin/${encodeURIComponent(partyId)}/bulk-invite`, partyDetails),
  scanQr: (qrToken, actualPlusOnes) => api.post('/checkin/scan', { qrToken, actualPlusOnes }),
  manualCheckin: (partyId, guestId, actualPlusOnes) => api.post(`/checkin/${encodeURIComponent(partyId)}/manual-checkin/${guestId}`, { actualPlusOnes }),
  undoCheckin: (partyId, guestId) => api.post(`/checkin/${encodeURIComponent(partyId)}/undo-checkin/${guestId}`),
  syncSheets: (partyId) => api.post(`/checkin/${encodeURIComponent(partyId)}/sync-sheets`),
  getStatus: () => api.get('/checkin/status'),
};

export const reportAPI = {
  getDaily: (date) => api.get('/reports/daily', { params: { date } }),
  getRange: (from, to) => api.get('/reports/range', { params: { from, to } }),
  exportData: (params) => api.get('/reports/export', { params, responseType: 'blob' }),
  sendDaily: () => api.post('/reports/send-daily'),
  sendRange: (from, to, label) => api.post('/reports/send-range', { from, to, label }),
};
