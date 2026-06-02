import { Menu, Bell, Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const titles = {
  '/dashboard':   'Dashboard',
  '/buildings':   'Buildings',
  '/floor-plans': 'Floor Plans',
  '/leads':       'Leads & Inquiries',
};

export default function Header({ onMenuToggle }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const title = titles[location.pathname] || 'FloorVerse';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-6 flex-shrink-0">
      <button onClick={onMenuToggle} className="text-gray-500 hover:text-gray-700 p-1 rounded">
        <Menu size={20} />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/floor-plans')}
          className="btn-primary btn-sm flex items-center gap-1.5"
        >
          <Plus size={14} />
          New Floor Plan
        </button>

        <button className="relative text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900 leading-none">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
