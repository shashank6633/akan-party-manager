import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
 const { login } = useAuth();
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!username || !password) {
 setError('Please enter both username and password');
 return;
 }
 setError('');
 setLoading(true);
 try {
 await login({ username, password });
 } catch (err) {
 setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#af4408] via-[#c4581c] to-[#8a3506] p-4">
 {/* Background decoration */}
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
 <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
 </div>

 <div className="relative w-full max-w-md">
 {/* Card */}
 <div className="bg-white rounded-2xl shadow-2xl p-8 border border-white/20">
 {/* Brand */}
 <div className="text-center mb-8">
 <img src="/akan-logo.png" alt="AKAN" className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg shadow-[#af4408]/30 object-contain bg-[#af4408] p-1" />
 <h1 className="text-3xl font-bold text-gray-900">AKAN</h1>
 <p className="text-sm text-gray-500 mt-1">Party Management System</p>
 </div>

 {/* Error */}
 {error && (
 <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
 {error}
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Username
 </label>
 <input
 type="text"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-all text-sm"
 placeholder="Enter your username"
 autoFocus
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-all text-sm"
 placeholder="Enter your password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="w-full py-3 rounded-xl bg-[#af4408] hover:bg-[#963a07] text-white font-semibold text-sm shadow-lg shadow-[#af4408]/25 hover:shadow-[#af4408]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {loading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Signing in...
 </>
 ) : (
 'Sign In'
 )}
 </button>
 </form>

 {/* Footer */}
 <p className="text-center text-xs text-gray-400 mt-6">
 Contact administrator for credentials
 </p>
 </div>

 {/* Bottom brand text */}
 <p className="text-center text-xs text-white/50 mt-6">
 AKAN Party Manager &copy; {new Date().getFullYear()}
 </p>
 </div>
 </div>
 );
}
