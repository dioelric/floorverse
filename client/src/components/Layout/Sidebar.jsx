import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, LayoutTemplate,
  Users, Globe, LogOut, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/buildings',   icon: Building2,       label: 'Buildings' },
  { to: '/floor-plans', icon: LayoutTemplate,  label: 'Floor Plans' },
  { to: '/leads',       icon: Users,           label: 'Leads' },
  { to: '/marketplace', icon: Globe,           label: 'Marketplace', external: true },
];

export default function Sidebar({ open }) {
  const { user, logout } = useAuthStore();

  return (
    <aside className={`
      flex flex-col bg-primary-800 text-white transition-all duration-200 flex-shrink-0
      ${open ? 'w-60' : 'w-16'}
    `}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-primary-700 flex-shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 text-white font-black text-sm">
            FV
          </div>
          {open && (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">
              Floor<span className="text-blue-300">Verse</span>
            </span>
          )}
        </div>
      </div>

      {/* Tenant name */}
      {open && user?.tenant && (
        <div className="px-4 py-3 border-b border-primary-700">
          <p className="text-xs text-primary-300 uppercase tracking-widest mb-0.5">Workspace</p>
          <p className="text-sm font-semibold text-white truncate">{user.tenant.name}</p>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs bg-primary-600 text-blue-200 capitalize">
            {user.tenant.plan}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            target={label === 'Marketplace' ? '_blank' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-primary-600 text-white'
                 : 'text-primary-200 hover:bg-primary-700 hover:text-white'
               }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User / logout */}
      <div className="border-t border-primary-700 p-3">
        {open ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-primary-300 truncate capitalize">{user?.role?.replace('_',' ')}</p>
            </div>
            <button onClick={logout} className="text-primary-300 hover:text-white p-1 rounded" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={logout} className="flex items-center justify-center w-full text-primary-300 hover:text-white p-2 rounded-lg" title="Logout">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
