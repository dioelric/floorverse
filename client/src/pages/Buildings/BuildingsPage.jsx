import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, MapPin, Layers, Edit2, Trash2, X } from 'lucide-react';
import api from '../../services/api';

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ name: '', address: '', city: '', state: '', pincode: '', totalFloors: 1, description: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/buildings').then(r => setBuildings(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/buildings', form);
      setShowModal(false);
      setForm({ name: '', address: '', city: '', state: '', pincode: '', totalFloors: 1, description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create building');
    } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this building and all its floor plans?')) return;
    await api.delete(`/buildings/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Buildings</h2>
          <p className="text-sm text-gray-500">Manage your properties and projects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Add Building
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" /></div>
      ) : buildings.length === 0 ? (
        <div className="card p-16 text-center">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-700">No buildings yet</h3>
          <p className="text-sm text-gray-400 mt-1">Add your first building to start creating floor plans</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4"><Plus size={16} /> Add Building</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {buildings.map(b => (
            <div key={b.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Building2 size={20} className="text-primary-700" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => navigate(`/floor-plans?buildingId=${b.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-700" title="View floor plans">
                    <Layers size={15} />
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 mb-1">{b.name}</h3>

              {b.city && (
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
                  <MapPin size={12} />{b.city}{b.state ? `, ${b.state}` : ''}
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>{b.total_floors} floor{b.total_floors > 1 ? 's' : ''}</span>
                <span>{b.floor_plan_count} floor plan{b.floor_plan_count !== 1 ? 's' : ''}</span>
                <span className={`badge ${b.status === 'active' ? 'badge-green' : 'badge-gray'} ml-auto`}>{b.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-gray-900">Add New Building</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="label">Building / Project Name *</label>
                <input className="input" required placeholder="e.g. Rajan Heights Phase 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City *</label>
                  <input className="input" required placeholder="Mumbai" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" placeholder="Maharashtra" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" placeholder="Full address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" placeholder="400001" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Total Floors</label>
                  <input type="number" min={1} max={100} className="input" value={form.totalFloors} onChange={e => setForm(f => ({ ...f, totalFloors: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
