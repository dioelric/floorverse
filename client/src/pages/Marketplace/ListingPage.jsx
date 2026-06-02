import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Box, MapPin, Maximize2, Phone, Mail, Calendar, X } from 'lucide-react';
import api from '../../services/api';

const formatPrice = p => {
  if (!p) return null;
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(1)} Cr`;
  if (p >= 100000)   return `₹${(p / 100000).toFixed(1)} L`;
  return `₹${p.toLocaleString()}`;
};

export default function ListingPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]  = useState({ name: '', email: '', phone: '', message: '', budget: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/marketplace/listings/${id}`)
      .then(r => setListing(r.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleInquiry = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/marketplace/listings/${id}/inquire`, form);
      setSubmitted(true);
      setShowForm(false);
    } catch { }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
    </div>
  );

  if (!listing) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">Listing not found</p>
        <Link to="/marketplace" className="text-primary-600 text-sm hover:underline mt-2 block">Back to Marketplace</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/marketplace" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">{listing.name}</h1>
            <p className="text-sm text-gray-400">{listing.building_name}</p>
          </div>
          {!submitted && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Phone size={14} /> Enquire Now
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3D Viewer Embed */}
          <div className="card overflow-hidden">
            <div className="h-72 bg-gray-900 relative">
              <iframe
                src={`/viewer/${id}`}
                className="w-full h-full border-0"
                title="3D Floor Plan Viewer"
                allow="fullscreen"
              />
              <div className="absolute top-3 left-3 bg-primary-700 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Box size={11} /> Interactive 3D View
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Drag to orbit • Scroll to zoom</p>
              <Link to={`/viewer/${id}`} target="_blank" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1">
                <Maximize2 size={13} /> Open fullscreen
              </Link>
            </div>
          </div>

          {/* Details */}
          <div className="card p-6">
            <h2 className="font-bold text-gray-900 text-lg mb-4">About this Property</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {listing.unit_type && (
                <div><p className="text-xs text-gray-400">Unit Type</p><p className="font-semibold">{listing.unit_type}</p></div>
              )}
              {listing.area_sqft && (
                <div><p className="text-xs text-gray-400">Total Area</p><p className="font-semibold">{listing.area_sqft} sq.ft</p></div>
              )}
              {listing.floor_number && (
                <div><p className="text-xs text-gray-400">Floor</p><p className="font-semibold">{listing.floor_number}</p></div>
              )}
              {listing.city && (
                <div><p className="text-xs text-gray-400">Location</p><p className="font-semibold">{listing.city}{listing.state ? `, ${listing.state}` : ''}</p></div>
              )}
            </div>
            {listing.building_description && (
              <p className="text-sm text-gray-600 leading-relaxed">{listing.building_description}</p>
            )}
          </div>

          {/* Rooms */}
          {listing.rooms?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Room Details ({listing.rooms.length} rooms)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {listing.rooms.map(r => (
                  <div key={r.id} className="rounded-lg p-3 border border-gray-100" style={{ background: r.color || '#F9FAFB' }}>
                    <p className="font-semibold text-sm text-gray-800">{r.name}</p>
                    {r.area_sqft && <p className="text-xs text-gray-500 mt-0.5">{r.area_sqft} sq.ft</p>}
                    {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price */}
          <div className="card p-5">
            <div className="text-2xl font-extrabold text-primary-700">
              {formatPrice(listing.price_min)}
              {listing.price_max && listing.price_min !== listing.price_max && ` – ${formatPrice(listing.price_max)}`}
              {!listing.price_min && 'Price on Request'}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
              <MapPin size={13} /> {listing.city}{listing.state ? `, ${listing.state}` : ''}
            </div>

            {submitted ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✅ Inquiry submitted! The developer will contact you soon.
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="btn-primary w-full mt-4 btn-lg justify-center">
                <Phone size={16} /> Get Details
              </button>
            )}
          </div>

          {/* Developer */}
          <div className="card p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Developer</p>
            <div className="flex items-center gap-3">
              {listing.developer_logo
                ? <img src={listing.developer_logo} alt={listing.developer_name} className="w-10 h-10 rounded-lg object-contain" />
                : <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-sm">{listing.developer_name?.[0]}</div>
              }
              <div>
                <p className="font-semibold text-sm">{listing.developer_name}</p>
                <p className="text-xs text-gray-400">Verified Developer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold">Get Property Details</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleInquiry} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" required placeholder="Arjun Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" required placeholder="arjun@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Budget</label>
                <input className="input" placeholder="e.g. ₹60L - ₹80L" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea rows={3} className="input resize-none" placeholder="I'm interested in this property..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
