import { useState, useEffect } from 'react';
import {
 Users,
 Bell,
 Settings as SettingsIcon,
 Plus,
 Trash2,
 Edit3,
 Loader2,
 Send,
 CheckCircle,
 X,
} from 'lucide-react';
import { authAPI, notificationAPI, api } from '../services/api';
import { useAuth } from '../context/AuthContext';

import { Mail, Save } from 'lucide-react';

const ROLES = ['GRE', 'CASHIER', 'SALES', 'MANAGER', 'ADMIN'];
const TABS = [
 { id: 'users', label: 'Users', icon: Users },
 { id: 'notifications', label: 'Notifications', icon: Bell },
 { id: 'emails', label: 'Email Settings', icon: Mail },
 { id: 'system', label: 'System', icon: SettingsIcon },
];

export default function Settings() {
 const { user } = useAuth();
 const isAdmin = user?.role === 'ADMIN';
 const [activeTab, setActiveTab] = useState('users');
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showAddUser, setShowAddUser] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
 const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'GRE' });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [testingEmail, setTestingEmail] = useState(false);
 const [emailSettings, setEmailSettings] = useState({
   notificationEmails: '',
   salesEmail: '',
   managerEmail: '',
   adminEmail: '',
 });
 const [savingEmails, setSavingEmails] = useState(false);
 const [loadingEmails, setLoadingEmails] = useState(false);
 const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(false);
 const [togglingReminder, setTogglingReminder] = useState(false);

 useEffect(() => {
 if (activeTab === 'users') fetchUsers();
 if (activeTab === 'emails' && isAdmin) fetchEmailSettings();
 if (activeTab === 'notifications' && isAdmin) fetchReminderSetting();
 }, [activeTab]);

 const fetchReminderSetting = async () => {
 try {
 const res = await api.get('/notifications/payment-reminder-setting');
 setPaymentReminderEnabled(res.data.enabled ?? false);
 } catch { /* ignore */ }
 };

 const togglePaymentReminder = async () => {
 setTogglingReminder(true);
 try {
 const res = await api.post('/notifications/payment-reminder-setting', { enabled: !paymentReminderEnabled });
 setPaymentReminderEnabled(res.data.enabled);
 setSuccess(`Payment reminders ${res.data.enabled ? 'activated' : 'deactivated'}.`);
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError('Failed to update payment reminder setting.');
 } finally {
 setTogglingReminder(false);
 }
 };

 const fetchUsers = async () => {
 setLoading(true);
 try {
 const res = await authAPI.getUsers();
 setUsers(res.data.users || []);
 } catch (err) {
 console.error('Failed to fetch users:', err);
 } finally {
 setLoading(false);
 }
 };

 const handleAddUser = async () => {
 if (!formData.username || !formData.password || !formData.name) {
 setError('All fields are required.');
 return;
 }
 setSaving(true);
 setError('');
 try {
 await authAPI.createUser(formData);
 setShowAddUser(false);
 setFormData({ username: '', password: '', name: '', role: 'GRE' });
 setSuccess('User created successfully!');
 fetchUsers();
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError(err.response?.data?.message || 'Failed to create user.');
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteUser = async (userId) => {
 if (!confirm('Are you sure you want to delete this user?')) return;
 try {
 await authAPI.deleteUser(userId);
 fetchUsers();
 setSuccess('User deleted.');
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError('Failed to delete user.');
 }
 };

 const handleTestEmail = async () => {
 setTestingEmail(true);
 try {
 await api.post('/notifications/test-email');
 setSuccess('Test email sent successfully!');
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError('Email test failed. Check SMTP configuration.');
 } finally {
 setTestingEmail(false);
 }
 };

 const fetchEmailSettings = async () => {
 setLoadingEmails(true);
 try {
 const res = await notificationAPI.getEmailSettings();
 setEmailSettings(res.data.settings || {});
 } catch (err) {
 console.error('Failed to fetch email settings:', err);
 } finally {
 setLoadingEmails(false);
 }
 };

 const handleSaveEmailSettings = async () => {
 setSavingEmails(true);
 setError('');
 try {
 await notificationAPI.updateEmailSettings(emailSettings);
 setSuccess('Email settings saved successfully!');
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError(err.response?.data?.message || 'Failed to save email settings.');
 } finally {
 setSavingEmails(false);
 }
 };

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <div>
 <h1 className="text-xl font-bold text-gray-900">Settings</h1>
 <p className="text-sm text-gray-500">Manage users, notifications, and system configuration</p>
 </div>

 {/* Messages */}
 {success && (
 <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
 <CheckCircle className="w-4 h-4" /> {success}
 </div>
 )}
 {error && (
 <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
 {error}
 <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
 {TABS.map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-none justify-center sm:justify-start ${
 activeTab === tab.id
 ? 'bg-white text-[#af4408] shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 <tab.icon className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.id === 'emails' ? 'Email' : tab.label}</span>
 </button>
 ))}
 </div>

 {/* Users Tab */}
 {activeTab === 'users' && (
 <div className="bg-white rounded-xl border border-gray-200">
 <div className="flex items-center justify-between p-4 border-b border-gray-100">
 <h3 className="text-sm font-semibold text-gray-800">User Management</h3>
 <button
 onClick={() => { setShowAddUser(true); setError(''); }}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors"
 >
 <Plus className="w-3.5 h-3.5" /> Add User
 </button>
 </div>

 {/* Add user form */}
 {showAddUser && (
 <div className="p-4 bg-gray-50 border-b border-gray-100">
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
 <input
 type="text"
 placeholder="Full Name"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 <input
 type="text"
 placeholder="Username"
 value={formData.username}
 onChange={(e) => setFormData({ ...formData, username: e.target.value })}
 className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 <input
 type="password"
 placeholder="Password"
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
 className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 <select
 value={formData.role}
 onChange={(e) => setFormData({ ...formData, role: e.target.value })}
 className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 >
 {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
 </select>
 </div>
 <div className="flex justify-end gap-2 mt-3">
 <button onClick={() => setShowAddUser(false)} className="px-4 py-2.5 rounded-lg text-xs bg-gray-200 text-gray-700">Cancel</button>
 <button
 onClick={handleAddUser}
 disabled={saving}
 className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] disabled:opacity-50"
 >
 {saving ? 'Creating...' : 'Create User'}
 </button>
 </div>
 </div>
 )}

 {/* Users list */}
 {loading ? (
 <div className="p-8 text-center">
 <Loader2 className="w-6 h-6 animate-spin text-[#af4408] mx-auto" />
 </div>
 ) : (
 <div className="divide-y divide-gray-100 overflow-x-auto">
 {users.map((u, i) => (
 <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors min-w-0">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-[#af4408] flex items-center justify-center text-white text-sm font-bold">
 {u.name?.charAt(0)?.toUpperCase() || 'U'}
 </div>
 <div>
 <p className="text-sm font-medium text-gray-900">{u.name}</p>
 <p className="text-xs text-gray-500">@{u.username}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
 u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
 u.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' :
 u.role === 'SALES' ? 'bg-blue-100 text-blue-700' :
 'bg-green-100 text-green-700'
 }`}>
 {u.role}
 </span>
 {u.username !== 'admin' && (
 <button
 onClick={() => handleDeleteUser(u.rowIndex || i + 2)}
 className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>
 ))}
 {users.length === 0 && (
 <p className="p-8 text-center text-sm text-gray-400">No users found.</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* Notifications Tab */}
 {activeTab === 'notifications' && (
 <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
 <h3 className="text-sm font-semibold text-gray-800">Notification Settings</h3>
 <p className="text-xs text-gray-500">
 Email notifications are sent automatically on party creation, status changes, and cancellations.
 Configure SMTP settings in the backend .env file.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
 <p className="text-xs font-semibold text-gray-700 mb-1">New Party</p>
 <p className="text-xs text-gray-500">Notifies Sales Team via email</p>
 </div>
 <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
 <p className="text-xs font-semibold text-gray-700 mb-1">Status Change</p>
 <p className="text-xs text-gray-500">Notifies Manager via email</p>
 </div>
 <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
 <p className="text-xs font-semibold text-gray-700 mb-1">Cancellation</p>
 <p className="text-xs text-gray-500">Captures lost reason, notifies Manager</p>
 </div>
 <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
 <p className="text-xs font-semibold text-gray-700 mb-1">Daily Report</p>
 <p className="text-xs text-gray-500">Sent at 10 PM daily to Admin</p>
 </div>
 </div>
 {/* Payment Reminder Toggle */}
 {isAdmin && (
 <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
  <div>
  <p className="text-xs font-semibold text-gray-700">Auto Payment Reminders</p>
  <p className="text-xs text-gray-500 mt-0.5">Sends reminder emails to guests 2 days before, 1 day before, and on the due date at 8:00 AM</p>
  </div>
  <button
  onClick={togglePaymentReminder}
  disabled={togglingReminder}
  className={`relative w-12 h-6 rounded-full transition-colors ${paymentReminderEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
  >
  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${paymentReminderEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
  </button>
 </div>
 )}

 <button
 onClick={handleTestEmail}
 disabled={testingEmail}
 className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
 >
 {testingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
 Test Email
 </button>
 </div>
 )}

 {/* Email Settings Tab */}
 {activeTab === 'emails' && (
 <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-semibold text-gray-800">Email Notification Settings</h3>
 <p className="text-xs text-gray-500 mt-1">Manage which email addresses receive different types of notifications</p>
 </div>
 {isAdmin && (
 <button
 onClick={handleSaveEmailSettings}
 disabled={savingEmails}
 className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
 >
 {savingEmails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
 Save Changes
 </button>
 )}
 </div>

 {loadingEmails ? (
 <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#af4408] mx-auto" /></div>
 ) : !isAdmin ? (
 <p className="text-sm text-gray-500 py-4">Only ADMIN users can manage email settings.</p>
 ) : (
 <div className="space-y-5">
 {/* All Notifications */}
 <div className="space-y-2">
 <label className="block text-xs font-semibold text-gray-700">
 All Notifications <span className="font-normal text-gray-400">(New Party, Status Changes, Cancellations, Daily Reports, Follow-ups)</span>
 </label>
 <textarea
 value={emailSettings.notificationEmails}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, notificationEmails: e.target.value }))}
 rows={2}
 placeholder="email1@example.com,email2@example.com"
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 />
 <p className="text-[10px] text-gray-400">Comma-separated email addresses</p>
 </div>

 {/* Sales Notifications */}
 <div className="space-y-2">
 <label className="block text-xs font-semibold text-gray-700">
 Sales Team <span className="font-normal text-gray-400">(New Enquiry notifications)</span>
 </label>
 <textarea
 value={emailSettings.salesEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, salesEmail: e.target.value }))}
 rows={2}
 placeholder="sales@example.com"
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 />
 </div>

 {/* Manager Notifications */}
 <div className="space-y-2">
 <label className="block text-xs font-semibold text-gray-700">
 Manager <span className="font-normal text-gray-400">(Status changes, Cancellations)</span>
 </label>
 <textarea
 value={emailSettings.managerEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, managerEmail: e.target.value }))}
 rows={2}
 placeholder="manager@example.com"
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 />
 </div>

 {/* Admin Notifications */}
 <div className="space-y-2">
 <label className="block text-xs font-semibold text-gray-700">
 Admin <span className="font-normal text-gray-400">(Daily Reports, Critical Alerts)</span>
 </label>
 <textarea
 value={emailSettings.adminEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, adminEmail: e.target.value }))}
 rows={2}
 placeholder="admin@example.com"
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 />
 </div>

 {/* Info box */}
 <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
 <p className="text-xs text-blue-700">
 <strong>How it works:</strong> Enter comma-separated email addresses for each notification type. Changes take effect immediately after saving.
 </p>
 </div>
 </div>
 )}
 </div>
 )}

 {/* System Tab */}
 {activeTab === 'system' && (
 <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
 <h3 className="text-sm font-semibold text-gray-800">System Information</h3>
 <div className="space-y-3">
 {[
 { label: 'Application', value: 'AKAN Party Manager v1.0' },
 { label: 'Database', value: 'Google Sheets (Primary)' },
 { label: 'Auth', value: 'JWT-based authentication' },
 { label: 'Frontend', value: 'React + Tailwind CSS' },
 { label: 'Backend', value: 'Node.js + Express' },
 ].map((item) => (
 <div key={item.label} className="flex flex-wrap items-center justify-between gap-1 py-2 border-b border-gray-100 last:border-0">
 <span className="text-xs text-gray-500">{item.label}</span>
 <span className="text-xs font-medium text-gray-900 text-right">{item.value}</span>
 </div>
 ))}
 </div>
 <div className="pt-2">
 <p className="text-[10px] text-gray-400">
 Configure Google Sheets ID, SMTP, and API keys in backend .env file.
 WhatsApp API integration is placeholder-ready for future implementation.
 </p>
 </div>
 </div>
 )}
 </div>
 );
}
