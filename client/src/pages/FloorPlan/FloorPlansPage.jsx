import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutTemplate, Eye, Edit2, Trash2, Globe, GlobeLock, X } from 'lucide-react';
import api from '../../services/api';

export default function FloorPlansPage() {
  const [plans, setPlans]       = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState({ buildingId: '', name: '', floorNumber: 1, unitType: '2BHK', areaSqft: '', priceMin: '', priceMax: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [searchParams]          = useSearchParams();
  const buildingId              = searchParams.get('buildingId');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    const params = buildingId ? `?buildingId=${buildingId}` : '';
    api.get(`/floor-plans${params}`).then(r => setPlans(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/buildings').then(r => {
      setBuildings(r.data.data);
      if (buildingId) setForm(f => ({ ...f, buildingId }));
    });
  }, [buildingId]);

  const handleSave = async e => {
    e.preventDefault();
    if (!form.buildingId) { setError('Please select a building'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/floor-plans', form);
      setShowModal(false);
      navigate(`/editor/${data.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create floor plan');
    } finally { setSaving(false); }
  };

  const togglePublish = async (id, current) => {
    await api.post(`/floor-plans/${id}/publish`, { publish: !current });
    load();
  };

  const handleDelete = async id => {
    if (!confirm('Delete this floor plan?')) return;
    await api.delete(`/floor-plans/${id}`);
    load();
  };

  const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Villa', 'Commercial'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Floor Plans</h2>
          <p className="text-sm text-gray-500">Design and publish your 3D floor plans</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> New Floor Plan</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" /></div>
      ) : plans.length === 0 ? (
        <div className="card p-16 text-center">
          <LayoutTemplate size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-700">No floor plans yet</h3>
          <p className="text-sm text-gray-400 mt-1">Create your first floor plan and publish it in 3D</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4"><Plus size={16} /> Create Floor Plan</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(fp => (
            <div key={fp.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              {/* Thumbnail */}
              <div className="h-36 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center relative">
                {fp.thumbnail_url
                  ? <img src={fp.thumbnail_url} alt={fp.name} className="w-full h-full object-cover" />
                  : <LayoutTemplate size={40} className="text-primary-300" />
                }
                <div className="absolute top-2 right-2">
                  {fp.is_published
                    ? <span className="badge-green">Published</span>
                    : <span className="badge-gray">Draft</span>
                  }
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-gray-900 truncate">{fp.name}</h3>
                <p className="text-xs text-gray-400 mb-3 truncate">{fp.building_name} · Floor {fp.floor_number}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {fp.unit_type && <span className="badge-blue">{fp.unit_type}</span>}
                  {fp.area_sqft && <span className="badge-gray">{fp.area_sqft} sq.ft</span>}
                  {fp.view_count > 0 && (
                    <span className="badge-gray flex items-center gap-1">
                      <Eye size={10} /> {fp.view_count}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => navigate(`/editor/${fp.id}`)} className="btn-secondary flex-1 btn-sm justify-center">
                    <Edit2 size={13} /> Edit
                  </button>
                  <button onClick={() => navigate(`/viewer/${fp.id}`)} className="btn-secondary btn-sm px-2.5" title="Preview 3D">
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => togglePublish(fp.id, fp.is_published)}
                    className={`btn-sm px-2.5 ${fp.is_published ? 'btn-secondary text-orange-600' : 'btn-primary'}`}
                    title={fp.is_published ? 'Unpublish' : 'Publish'}
                  >
                    {fp.is_published ? <GlobeLock size={13} /> : <Globe size={13} />}
                  </button>
                  <button onClick={() => handleDelete(fp.id)} className="btn-sm px-2.5 btn-secondary hover:text-red-600 hover:border-red-200">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-gray-900">New Floor Plan</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div>
                <label className="label">Building *</label>
                <select className="input" required value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value }))}>
                  <option value="">Select building...</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name} – {b.city}</option>)}
                </select>
                {buildings.length === 0 && <p className="text-xs text-orange-600 mt-1">No buildings found. <a href="/buildings" className="underline">Create one first.</a></p>}
              </div>

              <div>
                <label className="label">Floor Plan Name *</label>
                <input className="input" required placeholder="e.g. 2BHK Type A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Unit Type</label>
                  <select className="input" value={form.unitType} onChange={e => setForm(f => ({ ...f, unitType: e.target.value }))}>
                    {unitTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Floor Number</label>
                  <input type="number" min={1} className="input" value={form.floorNumber} onChange={e => setForm(f => ({ ...f, floorNumber: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Total Area (sq.ft) *</label>
                <input type="number" className="input" placeholder="e.g. 850" required
                  value={form.areaSqft} onChange={e => setForm(f => ({ ...f, areaSqft: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">
                  This is the hard cap — the editor won't let room areas exceed this total.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min Price (₹)</label>
                  <input type="number" className="input" placeholder="5000000" value={form.priceMin} onChange={e => setForm(f => ({ ...f, priceMin: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Max Price (₹)</label>
                  <input type="number" className="input" placeholder="6500000" value={form.priceMax} onChange={e => setForm(f => ({ ...f, priceMax: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create & Open Editor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
