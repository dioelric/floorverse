import { useEffect, useState } from 'react';
import { Users, Phone, Mail, Calendar, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const STATUS_COLORS  = { new: 'badge-blue', contacted: 'badge-orange', qualified: 'badge-blue', converted: 'badge-green', lost: 'badge-red' };

export default function LeadsPage() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  const load = () => {
    setLoading(true);
    const params = filter ? `?status=${filter}` : '';
    api.get(`/marketplace/leads${params}`)
      .then(r => setLeads(r.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const updateStatus = async (id, status) => {
    await api.patch(`/marketplace/leads/${id}`, { status });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Leads & Inquiries</h2>
          <p className="text-sm text-gray-500">Manage buyer inquiries from your listings</p>
        </div>
        <select className="input w-auto text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" /></div>
      ) : leads.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-700">No leads yet</h3>
          <p className="text-sm text-gray-400 mt-1">Publish floor plans to start receiving inquiries</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Lead</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Property</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Contact</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                        {lead.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{lead.name}</p>
                        {lead.budget && <p className="text-xs text-gray-400">{lead.budget}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="font-medium text-gray-700 truncate max-w-32">{lead.floor_plan_name || '—'}</p>
                    <p className="text-xs text-gray-400">{lead.building_name}</p>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <div className="space-y-1">
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
                        <Mail size={11} /> {lead.email}
                      </a>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:underline">
                          <Phone size={11} /> {lead.phone}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead.id, e.target.value)}
                      className={`text-xs font-semibold border-0 bg-transparent rounded-full px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-300 capitalize
                        ${lead.status === 'new'       ? 'text-blue-700 bg-blue-50'   :
                          lead.status === 'contacted' ? 'text-orange-700 bg-orange-50' :
                          lead.status === 'qualified' ? 'text-blue-700 bg-blue-50'   :
                          lead.status === 'converted' ? 'text-green-700 bg-green-50' :
                          'text-red-700 bg-red-50'}`}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-xs text-gray-400">
                    {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
