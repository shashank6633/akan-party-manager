import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Shield,
  Clock,
  Key,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  LogIn,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authAPI.me();
      setProfile(res.data.user);
    } catch {
      setProfile(user);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const roleColors = {
    ADMIN: 'bg-red-100 text-red-700',
    MANAGER: 'bg-purple-100 text-purple-700',
    SALES: 'bg-blue-100 text-blue-700',
    GRE: 'bg-green-100 text-green-700',
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return 'Never';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  const p = profile || user;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-xs text-gray-500">Manage your account settings</p>
        </div>
      </div>

      {/* Messages */}
      {passwordMsg.text && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          passwordMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {passwordMsg.type === 'success' && <CheckCircle className="w-4 h-4" />}
          {passwordMsg.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Avatar + Name */}
        <div className="bg-[#af4408] p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-bold">
            {p?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{p?.name}</h2>
            <p className="text-sm text-white/70">@{p?.username}</p>
            <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors[p?.role] || 'bg-gray-100 text-gray-600'}`}>
              {p?.role}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Full Name</p>
              <p className="text-sm font-medium text-gray-900">{p?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm font-medium text-gray-900">{p?.role}</p>
            </div>
          </div>

          {p?.email && (
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-gray-500 text-xs font-bold">@</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{p?.email}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <LogIn className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Last Login</p>
              <p className="text-sm font-medium text-gray-900">{formatDateTime(p?.lastLogin)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Total Logins</p>
              <p className="text-sm font-medium text-gray-900">{p?.loginCount || 0} times</p>
            </div>
          </div>

          {p?.createdAt && (
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">Account Created</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(p?.createdAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordMsg({ type: '', text: '' }); }}
          className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-[#af4408]/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-[#af4408]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-900">Change Password</p>
            <p className="text-xs text-gray-500">Update your login password</p>
          </div>
        </button>

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="p-4 pt-0 space-y-3">
            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                  placeholder="Enter current password"
                  required
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                  placeholder="Enter new password (min 6 chars)"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                placeholder="Confirm new password"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] disabled:opacity-50 min-h-[44px] flex items-center gap-1.5"
              >
                {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                Update Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
