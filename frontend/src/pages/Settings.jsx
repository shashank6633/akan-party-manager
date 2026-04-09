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
 Clock,
 ShieldOff,
 ShieldCheck,
 FileText,
 Mail,
 Save,
 RotateCcw,
 KeyRound,
 Eye,
 EyeOff,
 ChevronUp,
 ChevronDown,
} from 'lucide-react';
import { authAPI, notificationAPI, api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DISCLAIMERS, PACKAGES, FULL_MENU, MENU_CATEGORIES } from '../data/menuTemplates';

const ROLES = ['GRE', 'CASHIER', 'ACCOUNTS', 'SALES', 'MANAGER', 'ADMIN', 'VIEWER', 'FEEDBACK'];

function getTimeAgo(date) {
 const now = new Date();
 const diffMs = now - date;
 const mins = Math.floor(diffMs / 60000);
 const hrs = Math.floor(diffMs / 3600000);
 const days = Math.floor(diffMs / 86400000);
 const months = Math.floor(days / 30);
 if (mins < 1) return 'Just now';
 if (mins < 60) return `${mins}m ago`;
 if (hrs < 24) return `${hrs}h ago`;
 if (days < 30) return `${days}d ago`;
 if (months < 12) return `${months}mo ago`;
 return `${Math.floor(months / 12)}y ago`;
}
const TABS = [
 { id: 'users', label: 'Users', icon: Users },
 { id: 'notifications', label: 'Notifications', icon: Bell },
 { id: 'emails', label: 'Email Settings', icon: Mail },
 { id: 'fp', label: 'F&P Settings', icon: FileText },
 { id: 'system', label: 'System', icon: SettingsIcon },
];

const FP_CATEGORY_LABELS = {
 vegStarters: 'Veg Starters',
 nonVegStarters: 'Non-Veg Starters',
 vegMainCourse: 'Veg Main Course',
 nonVegMainCourse: 'Non-Veg Main Course',
 rice: 'Rice',
 dal: 'Dal',
 salad: 'Salad',
 accompaniments: 'Accompaniments',
 desserts: 'Desserts',
};

const FP_DEFAULT_LIMITS = {
 vegStarters: 3,
 nonVegStarters: 3,
 vegMainCourse: 3,
 nonVegMainCourse: 3,
 rice: 1,
 dal: 1,
 salad: 1,
 accompaniments: 1,
 desserts: 2,
};

export default function Settings() {
 const { user } = useAuth();
 const isAdmin = user?.role === 'ADMIN';
 const [activeTab, setActiveTab] = useState('users');
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showAddUser, setShowAddUser] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
 const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'GRE', email: '' });
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
 // Password change
 const [pwChangeUser, setPwChangeUser] = useState(null); // { rowIndex, name, username }
 const [newPassword, setNewPassword] = useState('');
 const [showNewPw, setShowNewPw] = useState(false);
 const [changingPw, setChangingPw] = useState(false);
 // F&P Settings
 const [fpOverrides, setFpOverrides] = useState({});
 const [fpCustomTc, setFpCustomTc] = useState(null); // null = use defaults
 const [liquorOverrides, setLiquorOverrides] = useState({}); // { 'Platinum FL': { drinks: [...], cocktails, mocktails, softDrinks } }
 const [expandedLiquorPkg, setExpandedLiquorPkg] = useState(null);
 const [menuOverrides, setMenuOverrides] = useState({}); // { vegStarters: { subcategories: { Continental: [...] } }, rice: { items: [...] } }
 const [expandedMenuCat, setExpandedMenuCat] = useState(null);
 const [newItemText, setNewItemText] = useState('');
 const [loadingFp, setLoadingFp] = useState(false);
 const [savingFp, setSavingFp] = useState(false);
 // Email routing
 const [emailRouting, setEmailRouting] = useState({});
 const [loadingRouting, setLoadingRouting] = useState(false);
 const [savingRouting, setSavingRouting] = useState(false);

 useEffect(() => {
 if (activeTab === 'users') fetchUsers();
 if (activeTab === 'emails' && isAdmin) { fetchEmailSettings(); fetchEmailRouting(); }
 if (activeTab === 'notifications' && isAdmin) fetchReminderSetting();
 if (activeTab === 'fp') fetchFpSettings();
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
 setFormData({ username: '', password: '', name: '', role: 'GRE', email: '' });
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

 const handleToggleStatus = async (userId) => {
 try {
 const res = await authAPI.toggleUserStatus(userId);
 setSuccess(res.data.message);
 fetchUsers();
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError(err.response?.data?.message || 'Failed to update user status.');
 }
 };

 const handleResetPassword = async () => {
 if (!pwChangeUser || !newPassword) return;
 if (newPassword.length < 6) {
  setError('Password must be at least 6 characters.');
  return;
 }
 setChangingPw(true);
 setError('');
 try {
  const res = await authAPI.resetUserPassword(pwChangeUser.rowIndex, { newPassword });
  setSuccess(res.data.message || `Password for ${pwChangeUser.name} has been reset.`);
  setPwChangeUser(null);
  setNewPassword('');
  setShowNewPw(false);
  setTimeout(() => setSuccess(''), 4000);
 } catch (err) {
  setError(err.response?.data?.message || 'Failed to reset password.');
 } finally {
  setChangingPw(false);
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
 try {
 await notificationAPI.updateEmailSettings(emailSettings);
 return true;
 } catch (err) {
 console.error('Email settings save failed:', err);
 return false;
 } finally {
 setSavingEmails(false);
 }
 };

 // Email Routing — defaults used if backend endpoint not yet available
 const DEFAULT_EMAIL_ROUTING = {
 newParty: ['SALES', 'MANAGER'],
 statusChange: ['MANAGER', 'SALES'],
 cancellation: ['MANAGER', 'ADMIN'],
 staleEnquiry: ['SALES', 'MANAGER'],
 criticalAlert: ['ADMIN'],
 dailyFollowUp: ['SALES', 'MANAGER', 'ADMIN'],
 dailyReport: ['MANAGER', 'ADMIN'],
 billingUpdate: ['MANAGER', 'ADMIN', 'ACCOUNTS'],
 pendingPayments: ['ACCOUNTS', 'MANAGER'],
 };

 const fetchEmailRouting = async () => {
 setLoadingRouting(true);
 try {
 const res = await notificationAPI.getEmailRouting();
 setEmailRouting(res.data.routing || DEFAULT_EMAIL_ROUTING);
 } catch (err) {
 console.error('Failed to fetch email routing:', err);
 // Use defaults so checkboxes aren't empty
 setEmailRouting(DEFAULT_EMAIL_ROUTING);
 } finally {
 setLoadingRouting(false);
 }
 };

 const handleSaveEmailRouting = async () => {
 setSavingRouting(true);
 try {
 await notificationAPI.updateEmailRouting(emailRouting);
 return true;
 } catch (err) {
 console.error('Email routing save failed:', err);
 return false;
 } finally {
 setSavingRouting(false);
 }
 };

 const toggleRoutingRole = (notifType, role) => {
 setEmailRouting((prev) => {
 const current = prev[notifType] || [];
 const has = current.includes(role);
 return {
  ...prev,
  [notifType]: has ? current.filter((r) => r !== role) : [...current, role],
 };
 });
 };

 // F&P Settings
 const fetchFpSettings = async () => {
 setLoadingFp(true);
 try {
 const res = await notificationAPI.getFpSettings();
 const s = res.data.settings || {};
 setFpOverrides(s.overrides || {});
 setFpCustomTc(s.customTc || null);
 setLiquorOverrides(s.liquorOverrides || {});
 setMenuOverrides(s.menuOverrides || {});
 } catch (err) {
 console.error('Failed to fetch F&P settings:', err);
 } finally {
 setLoadingFp(false);
 }
 };

 const handleSaveFpSettings = async () => {
 setSavingFp(true);
 setError('');
 try {
 await notificationAPI.updateFpSettings({ overrides: fpOverrides, customTc: fpCustomTc, liquorOverrides, menuOverrides });
 setSuccess('F&P settings saved! Changes apply to new F&P records.');
 setTimeout(() => setSuccess(''), 3000);
 } catch (err) {
 setError(err.response?.data?.message || 'Failed to save F&P settings.');
 } finally {
 setSavingFp(false);
 }
 };

 const updateFpOverride = (category, value) => {
 const num = parseInt(value, 10);
 if (isNaN(num) || num < 0) return;
 setFpOverrides((prev) => ({ ...prev, [category]: num }));
 };

 const removeFpOverride = (category) => {
 setFpOverrides((prev) => {
 const next = { ...prev };
 delete next[category];
 return next;
 });
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
 <tab.icon className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.id === 'emails' ? 'Email' : tab.id === 'fp' ? 'F&P' : tab.label}</span>
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
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
 type="email"
 placeholder="Email Address"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
 <div className="divide-y divide-gray-100">
 {users.map((u, i) => {
 const isInactive = u.status === 'Inactive';
 const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
 const lastLoginAgo = lastLoginDate ? getTimeAgo(lastLoginDate) : 'Never';
 return (
 <div key={i} className={`p-4 hover:bg-gray-50 transition-colors ${isInactive ? 'opacity-60' : ''}`}>
  {/* Row 1: Avatar + Name + Role + Status */}
  <div className="flex items-center justify-between gap-2">
  <div className="flex items-center gap-3 min-w-0 flex-1">
   <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isInactive ? 'bg-gray-400' : 'bg-[#af4408]'}`}>
   {u.name?.charAt(0)?.toUpperCase() || 'U'}
   </div>
   <div className="min-w-0">
   <div className="flex items-center gap-2">
    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
    {isInactive && (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">INACTIVE</span>
    )}
   </div>
   <p className="text-xs text-gray-500">@{u.username}{u.email ? <span className="ml-2 text-gray-400">· {u.email}</span> : <span className="ml-2 text-red-400 italic">No email</span>}</p>
   </div>
  </div>
  <div className="flex items-center gap-2 shrink-0">
   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
   u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
   u.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' :
   u.role === 'SALES' ? 'bg-blue-100 text-blue-700' :
   u.role === 'CASHIER' ? 'bg-amber-100 text-amber-700' :
   u.role === 'VIEWER' ? 'bg-gray-200 text-gray-700' :
   'bg-green-100 text-green-700'
   }`}>
   {u.role}
   </span>
  </div>
  </div>
  {/* Row 2: Last login + Active status + Actions */}
  <div className="flex items-center justify-between gap-2 mt-2 ml-12">
  <div className="flex items-center gap-3 flex-wrap">
   {lastLoginDate && (new Date() - lastLoginDate) < 7 * 24 * 60 * 60 * 1000 ? (
   <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
    Active · {lastLoginAgo}
   </span>
   ) : (
   <span className="flex items-center gap-1 text-[11px] text-gray-400">
    <Clock className="w-3 h-3" />
    {lastLoginDate ? `Last seen ${lastLoginAgo}` : 'Never logged in'}
   </span>
   )}
  </div>
  <div className="flex items-center gap-1.5 shrink-0">
   {/* Change Password */}
   <button
    onClick={() => { setPwChangeUser({ rowIndex: u._rowIndex || u.rowIndex || i + 2, name: u.name, username: u.username }); setNewPassword(''); setShowNewPw(false); }}
    className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
    title="Change password"
   >
    <KeyRound className="w-3.5 h-3.5" />
   </button>
   {/* Toggle Active/Inactive */}
   {u.username !== 'admin' && (
   <button
    onClick={() => handleToggleStatus(u._rowIndex || u.rowIndex || i + 2)}
    className={`p-2 rounded-lg transition-colors ${isInactive ? 'text-green-600 hover:bg-green-50' : 'text-amber-500 hover:bg-amber-50'}`}
    title={isInactive ? 'Reactivate user' : 'Deactivate user'}
   >
    {isInactive ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
   </button>
   )}
   {/* Delete */}
   {u.username !== 'admin' && (
   <button
    onClick={() => handleDeleteUser(u._rowIndex || u.rowIndex || i + 2)}
    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
   >
    <Trash2 className="w-3.5 h-3.5" />
   </button>
   )}
  </div>
  </div>
 </div>
 );
 })}
 {users.length === 0 && (
 <p className="p-8 text-center text-sm text-gray-400">No users found.</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* Password Change Modal */}
 {pwChangeUser && (
 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPwChangeUser(null)}>
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
  <div className="flex items-center justify-between mb-4">
   <div className="flex items-center gap-2">
   <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
    <KeyRound className="w-4 h-4 text-blue-600" />
   </div>
   <div>
    <h3 className="text-sm font-bold text-gray-900">Change Password</h3>
    <p className="text-xs text-gray-500">@{pwChangeUser.username} — {pwChangeUser.name}</p>
   </div>
   </div>
   <button onClick={() => setPwChangeUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
   <X className="w-4 h-4" />
   </button>
  </div>
  <div className="space-y-3">
   <div>
   <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
   <div className="relative">
    <input
    type={showNewPw ? 'text' : 'password'}
    value={newPassword}
    onChange={(e) => setNewPassword(e.target.value)}
    placeholder="Minimum 6 characters"
    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
    autoFocus
    />
    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
   </div>
   {newPassword && newPassword.length < 6 && (
    <p className="text-[10px] text-red-500 mt-1">Password must be at least 6 characters</p>
   )}
   </div>
   <div className="flex items-center gap-2 pt-1">
   <button
    onClick={() => setPwChangeUser(null)}
    className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
   >
    Cancel
   </button>
   <button
    onClick={handleResetPassword}
    disabled={changingPw || !newPassword || newPassword.length < 6}
    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
   >
    {changingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
    {changingPw ? 'Saving...' : 'Reset Password'}
   </button>
   </div>
  </div>
  </div>
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
  <p className="text-xs text-gray-500 mt-0.5">Sends reminder emails to guests on the due date at 8:00 AM</p>
  </div>
  <div className="flex items-center gap-2">
  <span className={`text-[10px] font-bold ${paymentReminderEnabled ? 'text-green-600' : 'text-gray-400'}`}>
   {paymentReminderEnabled ? 'ON' : 'OFF'}
  </span>
  <button
   onClick={togglePaymentReminder}
   disabled={togglingReminder}
   className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${paymentReminderEnabled ? 'bg-green-500 focus:ring-green-400' : 'bg-gray-300 focus:ring-gray-400'} ${togglingReminder ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
   <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${paymentReminderEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
  </button>
  </div>
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
 <div className="space-y-5">
 {/* Notification Routing Card */}
 <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-semibold text-gray-800">Email Notification Routing</h3>
 <p className="text-xs text-gray-500 mt-1">Click checkboxes to change who receives each notification. Save to apply.</p>
 </div>
 {isAdmin && (
 <button
 onClick={async () => {
 setError('');
 const [routingOk, emailsOk] = await Promise.all([handleSaveEmailRouting(), handleSaveEmailSettings()]);
 const fails = [];
 if (!routingOk) fails.push('routing');
 if (!emailsOk) fails.push('fallback emails');
 if (fails.length > 0) setError(`Failed to save: ${fails.join(', ')}. Backend may need restart.`);
 else { setSuccess('All email settings saved successfully!'); setTimeout(() => setSuccess(''), 3000); }
 }}
 disabled={savingRouting || savingEmails}
 className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
 >
 {(savingRouting || savingEmails) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
 Save All
 </button>
 )}
 </div>

 {(loadingEmails || loadingRouting) ? (
 <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#af4408] mx-auto" /></div>
 ) : !isAdmin ? (
 <p className="text-sm text-gray-500 py-4">Only ADMIN users can manage email settings.</p>
 ) : (
 <div className="space-y-4">
 {/* Editable routing table */}
 <div className="overflow-x-auto rounded-lg border border-gray-200">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-2.5 font-semibold text-gray-700 min-w-[180px]">Notification Type</th>
 {ROLES.map((r) => (
 <th key={r} className="text-center px-2 py-2.5 font-semibold text-gray-700 min-w-[70px]">{r}</th>
 ))}
 <th className="text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[180px]">Trigger</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {[
  { key: 'newParty', label: 'New Party Enquiry', trigger: 'When a new party is created', color: 'blue' },
  { key: 'statusChange', label: 'Status Change', trigger: 'When party status is updated', color: 'amber' },
  { key: 'cancellation', label: 'Cancellation', trigger: 'When a party is cancelled', color: 'red' },
  { key: 'staleEnquiry', label: 'Stale Enquiry Alert', trigger: 'Every 15 min — enquiry not updated', color: 'orange' },
  { key: 'criticalAlert', label: 'Critical Alert (1hr+)', trigger: 'Every 15 min — escalation', color: 'purple' },
  { key: 'dailyFollowUp', label: 'Follow-up + Payment + Upcoming', trigger: 'Daily at 9:00 AM', color: 'green' },
  { key: 'dailyReport', label: 'End of Day Summary', trigger: 'Daily at 10:00 PM', color: 'indigo' },
  { key: 'billingUpdate', label: 'Billing Update', trigger: 'When cashier records payment', color: 'cyan' },
  { key: 'pendingPayments', label: 'Pending Payments (Accounts)', trigger: 'Daily at 9:30 AM IST', color: 'indigo' },
 ].map(({ key, label, trigger, color }) => (
  <tr key={key} className="hover:bg-gray-50/50">
  <td className="px-4 py-3 font-medium text-gray-800">{label}</td>
  {ROLES.map((role) => {
  const checked = (emailRouting[key] || []).includes(role);
  return (
  <td key={role} className="text-center px-2 py-3">
   <label className="inline-flex items-center justify-center cursor-pointer">
   <input
    type="checkbox"
    checked={checked}
    onChange={() => toggleRoutingRole(key, role)}
    className="w-4 h-4 rounded border-gray-300 text-[#af4408] focus:ring-[#af4408]/30 cursor-pointer"
   />
   </label>
  </td>
  );
  })}
  <td className="px-3 py-3 text-gray-500">{trigger}</td>
  </tr>
 ))}
 {/* Payment Reminder — fixed, not editable */}
 <tr className="hover:bg-gray-50/50 bg-gray-50/30">
 <td className="px-4 py-3 font-medium text-gray-800">Payment Reminder to Guest</td>
 {ROLES.map((role) => (
 <td key={role} className="text-center px-2 py-3">
  <span className="text-gray-300">—</span>
 </td>
 ))}
 <td className="px-3 py-3 text-gray-500">
  <span className="text-teal-600 font-medium">Sent to Guest Email</span> · Daily 8 AM (if enabled)
 </td>
 </tr>
 </tbody>
 </table>
 </div>

 {/* Fallback email addresses */}
 <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
 <p className="text-xs text-amber-700 font-semibold mb-2">Fallback Email Addresses</p>
 <p className="text-[10px] text-amber-600 mb-3">Used only when user accounts don't have email set. The system auto-picks emails from user accounts by role.</p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div>
 <label className="block text-[10px] font-semibold text-gray-600 mb-1">Sales Fallback</label>
 <input
 value={emailSettings.salesEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, salesEmail: e.target.value }))}
 placeholder="sales@example.com"
 className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 </div>
 <div>
 <label className="block text-[10px] font-semibold text-gray-600 mb-1">Manager Fallback</label>
 <input
 value={emailSettings.managerEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, managerEmail: e.target.value }))}
 placeholder="manager@example.com"
 className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 </div>
 <div>
 <label className="block text-[10px] font-semibold text-gray-600 mb-1">Admin Fallback</label>
 <input
 value={emailSettings.adminEmail}
 onChange={(e) => setEmailSettings((prev) => ({ ...prev, adminEmail: e.target.value }))}
 placeholder="admin@example.com"
 className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 </div>
 </div>
 </div>

 {/* Info box */}
 <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
 <p className="text-xs text-blue-700">
 <strong>How it works:</strong> Each user account has an email (set in Users tab). The system collects all emails matching the checked roles and sends the notification to all of them. Example: If 3 Sales users have emails and Sales is checked for "New Party", all 3 get the email.
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* F&P Settings Tab */}
 {activeTab === 'fp' && (
 <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-semibold text-gray-800">F&P Category Limits</h3>
 <p className="text-xs text-gray-500 mt-1">
  Override the default number of items a party can select in each menu category.
  These overrides apply across all packages.
 </p>
 </div>
 {isAdmin && (
 <button
  onClick={handleSaveFpSettings}
  disabled={savingFp}
  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
 >
  {savingFp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
  Save
 </button>
 )}
 </div>

 {loadingFp ? (
 <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#af4408] mx-auto" /></div>
 ) : !isAdmin ? (
 <p className="text-sm text-gray-500 py-4">Only ADMIN users can manage F&P settings.</p>
 ) : (
 <>
 {/* Info box */}
 <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
 <p className="text-xs text-amber-800">
  <strong>How it works:</strong> Set an override limit for any category. For example, if a party requests 4 veg starters instead of the default 3, set Veg Starters to 4.
  Leave blank to use the package default. Overrides apply to <strong>all packages</strong> when creating F&P records.
 </p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {Object.entries(FP_CATEGORY_LABELS).map(([key, label]) => {
  const hasOverride = fpOverrides[key] !== undefined && fpOverrides[key] !== null;
  const defaultVal = FP_DEFAULT_LIMITS[key];
  return (
  <div key={key} className={`p-3 rounded-lg border transition-colors ${hasOverride ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
   <div className="flex items-center justify-between mb-2">
   <label className="text-xs font-semibold text-gray-700">{label}</label>
   {hasOverride && (
    <button
    onClick={() => removeFpOverride(key)}
    className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
    title="Reset to default"
    >
    <RotateCcw className="w-3 h-3" /> Reset
    </button>
   )}
   </div>
   <div className="flex items-center gap-2">
   <input
    type="number"
    min={0}
    max={20}
    value={hasOverride ? fpOverrides[key] : ''}
    placeholder={String(defaultVal)}
    onChange={(e) => updateFpOverride(key, e.target.value)}
    className={`w-20 px-3 py-2 rounded-lg border text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 ${
    hasOverride ? 'bg-white border-amber-300 text-[#af4408]' : 'bg-white border-gray-200 text-gray-400'
    }`}
   />
   <span className="text-[10px] text-gray-400">
    Default: <strong>{defaultVal}</strong>
   </span>
   </div>
  </div>
  );
 })}
 </div>

 {/* Active Overrides Summary */}
 {Object.keys(fpOverrides).length > 0 && (
 <div className="p-3 rounded-lg bg-green-50 border border-green-200">
  <p className="text-xs font-semibold text-green-800 mb-1">Active Overrides:</p>
  <div className="flex flex-wrap gap-2">
  {Object.entries(fpOverrides).map(([key, val]) => (
   <span key={key} className="px-2 py-1 rounded-full bg-green-100 text-xs font-medium text-green-700">
   {FP_CATEGORY_LABELS[key]}: {val} items
   </span>
  ))}
  </div>
 </div>
 )}

 {/* Terms & Conditions Editor */}
 <div className="border-t border-gray-200 pt-5">
 <div className="flex items-center justify-between mb-3">
  <div>
  <h3 className="text-sm font-semibold text-gray-800">Terms & Conditions</h3>
  <p className="text-xs text-gray-500 mt-0.5">Edit the T&C that appear on F&P documents and PDFs. One term per line.</p>
  </div>
  {fpCustomTc && (
  <button
   onClick={() => setFpCustomTc(null)}
   className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
   title="Reset to default T&C"
  >
   <RotateCcw className="w-3 h-3" /> Reset to Default
  </button>
  )}
 </div>
 <textarea
  value={(fpCustomTc || DISCLAIMERS).join('\n')}
  onChange={(e) => {
  const lines = e.target.value.split('\n').filter((l) => l.trim());
  setFpCustomTc(lines.length > 0 ? lines : null);
  }}
  rows={8}
  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 font-mono leading-relaxed"
  placeholder="Enter terms and conditions, one per line..."
 />
 <p className="text-[10px] text-gray-400 mt-1">
  {fpCustomTc ? `${fpCustomTc.length} custom terms` : 'Using default terms'} — Changes saved with the Save button above.
 </p>
 </div>

 {/* Food Menu Editor */}
 <div className="border-t border-gray-200 pt-5">
 <div className="mb-3">
  <h3 className="text-sm font-semibold text-gray-800">🍽️ Food Menu Items</h3>
  <p className="text-xs text-gray-500 mt-0.5">
  Add, edit, or remove food items in each category. Click a category to expand. Changes are saved with the Save button above.
  </p>
 </div>

 <div className="space-y-2">
  {MENU_CATEGORIES.map((catKey) => {
  const catDef = FULL_MENU[catKey];
  if (!catDef) return null;
  const isExpanded = expandedMenuCat === catKey;
  const hasOverride = !!menuOverrides[catKey];
  const hasSubs = !!catDef.subcategories;

  // Get effective items (override or default)
  const getEffectiveItems = (subKey) => {
   if (hasOverride && hasSubs && menuOverrides[catKey]?.subcategories?.[subKey]) {
   return menuOverrides[catKey].subcategories[subKey];
   }
   if (hasOverride && !hasSubs && menuOverrides[catKey]?.items) {
   return menuOverrides[catKey].items;
   }
   if (hasSubs) return catDef.subcategories[subKey] || [];
   return catDef.items || [];
  };

  const totalItems = hasSubs
   ? Object.keys(catDef.subcategories).reduce((sum, sk) => sum + getEffectiveItems(sk).length, 0)
   : getEffectiveItems().length;

  return (
   <div key={catKey} className={`rounded-lg border transition-colors ${hasOverride ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'}`}>
   <button
    onClick={() => { setExpandedMenuCat(isExpanded ? null : catKey); setNewItemText(''); }}
    className="w-full flex items-center justify-between px-4 py-3 text-left"
   >
    <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-800">{catDef.label}</span>
    {hasOverride && (
     <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-700">CUSTOM</span>
    )}
    </div>
    <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-400">{totalItems} items</span>
    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
    </div>
   </button>

   {isExpanded && (
    <div className="px-4 pb-4 border-t border-gray-200/50 space-y-3">
    {/* Reset button */}
    {hasOverride && (
     <div className="flex justify-end mt-2">
     <button
      onClick={() => setMenuOverrides((prev) => { const n = { ...prev }; delete n[catKey]; return n; })}
      className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
     >
      <RotateCcw className="w-3 h-3" /> Reset to Default
     </button>
     </div>
    )}

    {hasSubs ? (
     /* Subcategory-based category */
     Object.keys(catDef.subcategories).map((subKey) => {
     const items = getEffectiveItems(subKey);
     return (
      <div key={subKey} className="mt-2">
      <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{subKey}</label>
      <div className="mt-1 space-y-1">
       {items.map((item, idx) => (
       <div key={idx} className="flex items-center gap-2 group">
        <input
        type="text"
        value={item}
        onChange={(e) => {
         const updated = [...items];
         updated[idx] = e.target.value;
         setMenuOverrides((prev) => ({
         ...prev,
         [catKey]: {
          ...prev[catKey],
          subcategories: {
          ...(catDef.subcategories),
          ...(prev[catKey]?.subcategories || {}),
          [subKey]: updated,
          },
         },
         }));
        }}
        className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
        <button
        onClick={() => {
         const updated = items.filter((_, i) => i !== idx);
         setMenuOverrides((prev) => ({
         ...prev,
         [catKey]: {
          ...prev[catKey],
          subcategories: {
          ...(catDef.subcategories),
          ...(prev[catKey]?.subcategories || {}),
          [subKey]: updated,
          },
         },
         }));
        }}
        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove item"
        >
        <Trash2 className="w-3 h-3" />
        </button>
       </div>
       ))}
       {/* Add new item */}
       <div className="flex items-center gap-2 mt-1">
       <input
        type="text"
        placeholder={`Add ${subKey} item...`}
        onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
         const val = e.target.value.trim();
         const updated = [...items, val];
         setMenuOverrides((prev) => ({
         ...prev,
         [catKey]: {
          ...prev[catKey],
          subcategories: {
          ...(catDef.subcategories),
          ...(prev[catKey]?.subcategories || {}),
          [subKey]: updated,
          },
         },
         }));
         e.target.value = '';
        }
        }}
        className="flex-1 px-2.5 py-1.5 rounded border border-dashed border-emerald-300 bg-emerald-50/30 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 placeholder:text-gray-300"
       />
       <Plus className="w-3.5 h-3.5 text-emerald-400" />
       </div>
      </div>
      </div>
     );
     })
    ) : (
     /* Flat items category */
     <div className="mt-2">
     <div className="space-y-1">
      {getEffectiveItems().map((item, idx) => (
      <div key={idx} className="flex items-center gap-2 group">
       <input
       type="text"
       value={item}
       onChange={(e) => {
        const items = getEffectiveItems();
        const updated = [...items];
        updated[idx] = e.target.value;
        setMenuOverrides((prev) => ({
        ...prev,
        [catKey]: { items: updated },
        }));
       }}
       className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
       />
       <button
       onClick={() => {
        const items = getEffectiveItems();
        const updated = items.filter((_, i) => i !== idx);
        setMenuOverrides((prev) => ({
        ...prev,
        [catKey]: { items: updated },
        }));
       }}
       className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
       title="Remove item"
       >
       <Trash2 className="w-3 h-3" />
       </button>
      </div>
      ))}
      {/* Add new item */}
      <div className="flex items-center gap-2 mt-1">
      <input
       type="text"
       placeholder="Add item..."
       onKeyDown={(e) => {
       if (e.key === 'Enter' && e.target.value.trim()) {
        const val = e.target.value.trim();
        const items = getEffectiveItems();
        setMenuOverrides((prev) => ({
        ...prev,
        [catKey]: { items: [...items, val] },
        }));
        e.target.value = '';
       }
       }}
       className="flex-1 px-2.5 py-1.5 rounded border border-dashed border-emerald-300 bg-emerald-50/30 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 placeholder:text-gray-300"
      />
      <Plus className="w-3.5 h-3.5 text-emerald-400" />
      </div>
     </div>
     </div>
    )}
    </div>
   )}
   </div>
  );
  })}
 </div>

 {/* Summary of customized categories */}
 {Object.keys(menuOverrides).length > 0 && (
  <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
  <p className="text-xs font-semibold text-emerald-800 mb-1">Custom Menu Categories:</p>
  <div className="flex flex-wrap gap-2">
   {Object.keys(menuOverrides).map((key) => (
   <span key={key} className="px-2 py-1 rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
    {FULL_MENU[key]?.label || key}
   </span>
   ))}
  </div>
  </div>
 )}
 </div>

 {/* Liquor Brands Editor */}
 <div className="border-t border-gray-200 pt-5">
 <div className="mb-3">
  <h3 className="text-sm font-semibold text-gray-800">🍷 Liquor Brands by Package</h3>
  <p className="text-xs text-gray-500 mt-0.5">
  Edit the drink brands available for each package. Click a package to expand and edit. Changes are saved with the Save button above.
  </p>
 </div>

 <div className="space-y-2">
 {Object.entries(PACKAGES).filter(([, pkg]) => pkg.drinks && pkg.drinks.length > 0).map(([pkgKey, pkg]) => {
  const isExpanded = expandedLiquorPkg === pkgKey;
  const hasOverride = !!liquorOverrides[pkgKey];
  const currentDrinks = hasOverride ? (liquorOverrides[pkgKey].drinks || []) : pkg.drinks;
  const currentCocktails = hasOverride ? (liquorOverrides[pkgKey].cocktails ?? pkg.cocktails) : pkg.cocktails;
  const currentMocktails = hasOverride ? (liquorOverrides[pkgKey].mocktails ?? pkg.mocktails) : pkg.mocktails;
  const currentSoftDrinks = hasOverride ? (liquorOverrides[pkgKey].softDrinks ?? pkg.softDrinks) : pkg.softDrinks;

  return (
  <div key={pkgKey} className={`rounded-lg border transition-colors ${hasOverride ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 bg-gray-50'}`}>
   <button
   onClick={() => setExpandedLiquorPkg(isExpanded ? null : pkgKey)}
   className="w-full flex items-center justify-between px-4 py-3 text-left"
   >
   <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-800">{pkg.label}</span>
    <span className="text-[10px] text-gray-400">{pkg.price} · {pkg.serving}</span>
    {hasOverride && (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-700">CUSTOM</span>
    )}
   </div>
   <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-400">{currentDrinks.length} brands</span>
    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
   </div>
   </button>

   {isExpanded && (
   <div className="px-4 pb-4 space-y-3 border-t border-gray-200/50">
    <div className="mt-3">
    <div className="flex items-center justify-between mb-1">
     <label className="text-xs font-semibold text-gray-700">Drink Brands</label>
     {hasOverride && (
     <button
      onClick={() => setLiquorOverrides((prev) => { const n = { ...prev }; delete n[pkgKey]; return n; })}
      className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
     >
      <RotateCcw className="w-3 h-3" /> Reset to Default
     </button>
     )}
    </div>
    <textarea
     value={currentDrinks.join('\n')}
     onChange={(e) => {
     const brands = e.target.value.split('\n');
     setLiquorOverrides((prev) => ({
      ...prev,
      [pkgKey]: {
      ...(prev[pkgKey] || {}),
      drinks: brands.filter((b) => b.trim()),
      },
     }));
     }}
     rows={Math.min(Math.max(currentDrinks.length + 1, 4), 10)}
     className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 font-mono leading-relaxed"
     placeholder="One brand per line..."
    />
    <p className="text-[10px] text-gray-400">One brand per line. {currentDrinks.length} brand{currentDrinks.length !== 1 ? 's' : ''} listed.</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
     <label className="block text-[10px] font-semibold text-gray-600 mb-1">Cocktails</label>
     <input
     type="text"
     value={currentCocktails || ''}
     onChange={(e) => setLiquorOverrides((prev) => ({
      ...prev, [pkgKey]: { ...(prev[pkgKey] || {}), cocktails: e.target.value || null },
     }))}
     placeholder="e.g. 3 Cocktails"
     className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
     />
    </div>
    <div>
     <label className="block text-[10px] font-semibold text-gray-600 mb-1">Mocktails</label>
     <input
     type="text"
     value={currentMocktails || ''}
     onChange={(e) => setLiquorOverrides((prev) => ({
      ...prev, [pkgKey]: { ...(prev[pkgKey] || {}), mocktails: e.target.value || null },
     }))}
     placeholder="e.g. 3 Mocktails"
     className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
     />
    </div>
    <div>
     <label className="block text-[10px] font-semibold text-gray-600 mb-1">Soft Drinks</label>
     <input
     type="text"
     value={currentSoftDrinks || ''}
     onChange={(e) => setLiquorOverrides((prev) => ({
      ...prev, [pkgKey]: { ...(prev[pkgKey] || {}), softDrinks: e.target.value || null },
     }))}
     placeholder="e.g. Aerated Drinks"
     className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
     />
    </div>
    </div>
   </div>
   )}
  </div>
  );
 })}
 </div>

 {/* Summary of overridden packages */}
 {Object.keys(liquorOverrides).length > 0 && (
 <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
  <p className="text-xs font-semibold text-purple-800 mb-1">Custom Liquor Brands:</p>
  <div className="flex flex-wrap gap-2">
  {Object.entries(liquorOverrides).map(([key, val]) => (
   <span key={key} className="px-2 py-1 rounded-full bg-purple-100 text-xs font-medium text-purple-700">
   {PACKAGES[key]?.label || key}: {(val.drinks || []).length} brands
   </span>
  ))}
  </div>
 </div>
 )}
 </div>
 </>
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
