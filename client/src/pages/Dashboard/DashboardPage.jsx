import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LayoutTemplate, Users, Eye, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const statusColors = {
  new:       'badge-blue',
  contacted: 'badge-orange',
  qualified: 'badge-blue',
  converted: 'badge-green',
  lost:      'badge-red',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
    </div>
  );

  const kpis = [
    { label: 'Total Buildings',   value: stats?.buildings?.total    || 0, icon: Building2,      color: 'bg-blue-50 text-blue-600',   to: '/buildings' },
    { label: 'Floor Plans',        value: stats?.floorPlans?.total   || 0, icon: LayoutTemplate, color: 'bg-violet-50 text-violet-600', to: '/floor-plans' },
    { label: 'New Leads',          value: stats?.leads?.new          || 0, icon: Users,          color: 'bg-orange-50 text-orange-600', to: '/leads' },
    { label: 'Total 3D Views',     value: stats?.floorPlans?.totalViews || 0, icon: Eye,         color: 'bg-green-50 text-green-600',  to: '/floor-plans' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Good morning, {user?.firstName} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening in your workspace today.</p>
        </div>
        <Link to="/floor-plans" className="btn-primary">
          <Plus size={16} /> New Floor Plan
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{value.toLocaleString()}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={20} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Monthly 3D Views</h3>
            <TrendingUp size={16} className="text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats?.monthlyViews || []}>
              <defs>
                <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1A3C6B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1A3C6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="views" stroke="#1A3C6B" fill="url(#viewGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Leads */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Recent Leads</h3>
            <Link to="/leads" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {(stats?.recentLeads || []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No leads yet</p>
            )}
            {(stats?.recentLeads || []).map(lead => (
              <div key={lead.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                  {lead.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                  <p className="text-xs text-gray-400 truncate">{lead.floor_plan_name}</p>
                </div>
                <span className={statusColors[lead.status] || 'badge-gray'}>{lead.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Published vs Total */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 mb-4">Floor Plan Status</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Published</span>
              <span className="font-semibold">{stats?.floorPlans?.published || 0} / {stats?.floorPlans?.total || 0}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-700 rounded-full transition-all"
                style={{ width: stats?.floorPlans?.total ? `${(stats.floorPlans.published / stats.floorPlans.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <Link to="/floor-plans" className="btn-secondary btn-sm">Manage</Link>
        </div>
      </div>
    </div>
  );
}
