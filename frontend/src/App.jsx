import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

// Lazy imports would go here for code-splitting in production
// For now, placeholder pages that will be built out
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddParty from './pages/AddParty';
import PartyDetail from './pages/PartyDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import CashierBilling from './pages/CashierBilling';
import CalendarView from './pages/CalendarView';
import FPList from './pages/FPList';
import FPEditor from './pages/FPEditor';
import FeedbackList from './pages/FeedbackList';
import FeedbackForm from './pages/FeedbackForm';
import FeedbackDetail from './pages/FeedbackDetail';
import SheetsView from './pages/SheetsView';
import GuestContacts from './pages/GuestContacts';
import Layout from './components/Layout';

function ProtectedRoute({ children, adminOnly = false, hideForRoles = [] }) {
 const { user, loading } = useAuth();

 if (loading) {
 return (
 <div className="flex h-screen items-center justify-center bg-cream">
 <div className="flex flex-col items-center gap-3">
 <Loader2 className="h-8 w-8 animate-spin text-akan" />
 <p className="text-sm text-gray-500">Loading...</p>
 </div>
 </div>
 );
 }

 if (!user) {
 return <Navigate to="/login" replace />;
 }

 if (adminOnly && user.role !== 'ADMIN') {
 return <Navigate to="/" replace />;
 }

 if (hideForRoles.length > 0 && hideForRoles.includes(user.role)) {
 return <Navigate to="/" replace />;
 }

 return children;
}

// Lightweight role guard for nested routes (no loading/auth check — parent handles that)
function RoleGuard({ children, adminOnly = false, hideForRoles = [] }) {
 const { user } = useAuth();
 const fallback = user?.role === 'FEEDBACK' ? '/feedback' : '/';
 if (adminOnly && user?.role !== 'ADMIN') return <Navigate to={fallback} replace />;
 if (hideForRoles.length > 0 && hideForRoles.includes(user?.role)) return <Navigate to={fallback} replace />;
 return children;
}

function PublicRoute({ children }) {
 const { user, loading } = useAuth();

 if (loading) {
 return (
 <div className="flex h-screen items-center justify-center bg-cream">
 <Loader2 className="h-8 w-8 animate-spin text-akan" />
 </div>
 );
 }

 if (user) {
 return <Navigate to="/" replace />;
 }

 return children;
}

export default function App() {
 return (
 <Routes>
 <Route
 path="/login"
 element={
 <PublicRoute>
 <Login />
 </PublicRoute>
 }
 />

 <Route
 path="/"
 element={
 <ProtectedRoute>
 <Layout />
 </ProtectedRoute>
 }
 >
 <Route index element={
  <RoleGuard hideForRoles={['FEEDBACK']}>
   <Dashboard />
  </RoleGuard>
 } />
 <Route path="calendar" element={
  <RoleGuard hideForRoles={['FEEDBACK']}>
   <CalendarView />
  </RoleGuard>
 } />
 <Route path="add-party" element={
 <RoleGuard hideForRoles={['CASHIER', 'VIEWER', 'FEEDBACK']}>
 <AddParty />
 </RoleGuard>
 } />
 <Route path="parties/:id" element={
  <RoleGuard hideForRoles={['FEEDBACK']}>
   <PartyDetail />
  </RoleGuard>
 } />
 <Route path="fp" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'FEEDBACK']}>
   <FPList />
  </RoleGuard>
 } />
 <Route path="fp/new" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'FEEDBACK']}>
   <FPEditor />
  </RoleGuard>
 } />
 <Route path="fp/:id" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'FEEDBACK']}>
   <FPEditor />
  </RoleGuard>
 } />
 <Route path="feedback" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'ACCOUNTS', 'VIEWER']}>
   <FeedbackList />
  </RoleGuard>
 } />
 <Route path="feedback/new" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'ACCOUNTS', 'VIEWER']}>
   <FeedbackForm />
  </RoleGuard>
 } />
 <Route path="feedback/:id" element={
  <RoleGuard hideForRoles={['GRE', 'CASHIER', 'ACCOUNTS', 'VIEWER']}>
   <FeedbackDetail />
  </RoleGuard>
 } />
 <Route path="sheets" element={
 <RoleGuard hideForRoles={['CASHIER', 'FEEDBACK']}>
  <SheetsView />
 </RoleGuard>
 } />
 <Route path="cashier-billing" element={<CashierBilling />} />
 <Route path="guest-contacts" element={
  <RoleGuard hideForRoles={['CASHIER', 'ACCOUNTS', 'VIEWER', 'SALES', 'MANAGER', 'FEEDBACK']}>
   <GuestContacts />
  </RoleGuard>
 } />
 <Route path="profile" element={<Profile />} />
 <Route path="reports" element={
 <RoleGuard hideForRoles={['GRE', 'CASHIER', 'FEEDBACK']}>
 <Reports />
 </RoleGuard>
 } />
 <Route
 path="settings"
 element={
 <RoleGuard adminOnly>
 <Settings />
 </RoleGuard>
 }
 />
 </Route>

 <Route path="*" element={<Navigate to="/" replace />} />
 </Routes>
 );
}
