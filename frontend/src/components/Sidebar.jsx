import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Receipt,
  CalendarDays,
  FileText,
  MessageSquare,
  Table2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', hideFor: ['FEEDBACK'] },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar', hideFor: ['FEEDBACK'] },
  { to: '/add-party', icon: PlusCircle, label: 'Add Party', hideFor: ['CASHIER', 'ACCOUNTS', 'VIEWER', 'FEEDBACK'] },
  { to: '/guest-contacts', icon: UserPlus, label: 'Guest Contacts', showFor: ['GRE', 'ADMIN'] },
  { to: '/cashier-billing', icon: Receipt, label: 'Billing', showFor: ['CASHIER', 'ACCOUNTS', 'ADMIN', 'MANAGER'] },
  { to: '/fp', icon: FileText, label: 'F&P', hideFor: ['GRE', 'CASHIER', 'ACCOUNTS', 'FEEDBACK'] },
  { to: '/sheets', icon: Table2, label: 'Sheets View', hideFor: ['CASHIER', 'FEEDBACK'] },
  { to: '/feedback', icon: MessageSquare, label: 'Feedback', hideFor: ['GRE', 'CASHIER', 'ACCOUNTS', 'VIEWER'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', hideFor: ['GRE', 'CASHIER', 'ACCOUNTS', 'FEEDBACK'] },
  { to: '/settings', icon: Settings, label: 'Settings', hideFor: ['GRE', 'SALES', 'MANAGER', 'CASHIER', 'ACCOUNTS', 'VIEWER', 'FEEDBACK'] },
];

export default function Sidebar({ collapsed, onToggle, onClose }) {
  const { user, logout } = useAuth();

  const roleColors = {
    ADMIN: 'bg-red-100 text-red-700',
    MANAGER: 'bg-purple-100 text-purple-700',
    SALES: 'bg-blue-100 text-blue-700',
    CASHIER: 'bg-teal-100 text-teal-700',
    ACCOUNTS: 'bg-indigo-100 text-indigo-700',
    GRE: 'bg-green-100 text-green-700',
    VIEWER: 'bg-gray-100 text-gray-700',
    FEEDBACK: 'bg-amber-100 text-amber-700',
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 shrink-0 bg-[#af4408]">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/akan-logo.png" alt="AKAN" className="w-9 h-9 rounded-lg object-contain shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">AKAN</h1>
              <p className="text-[10px] text-white/60 -mt-1 truncate">
                Party Manager
              </p>
            </div>
          )}
        </div>
        {/* Close button for mobile */}
        {!collapsed && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems
            .filter((item) => {
              if (item.showFor) return item.showFor.includes(user?.role);
              return !item.hideFor || !item.hideFor.includes(user?.role);
            })
            .map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#af4408]/10 text-[#af4408]'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      {/* Footer: user + collapse toggle */}
      <div className="border-t border-gray-200 p-3 space-y-2 shrink-0">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#af4408] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <span
                className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  roleColors[user.role] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={onToggle}
          className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
