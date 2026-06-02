import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Eye, MapPin, Maximize2, Box } from 'lucide-react';
import api from '../../services/api';

const formatPrice = p => {
  if (!p) return null;
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(1)} Cr`;
  if (p >= 100000)   return `₹${(p / 100000).toFixed(1)} L`;
  return `₹${p.toLocaleString()}`;
};

export default function MarketplacePage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ search: '', city: '', unitType: '', minPrice: '', maxPrice: '' });
  const [page, setPage]         = useState(1);
  const [pagination, setPagination] = useState(null);

  const load = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 12 });
    if (filters.search)   params.set('search',   filters.search);
    if (filters.city)     params.set('city',      filters.city);
    if (filters.unitType) params.set('unitType',  filters.unitType);
    if (filters.minPrice) params.set('minPrice',  filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice',  filters.maxPrice);

    api.get(`/marketplace/listings?${params}`)
      .then(r => { setListings(r.data.data); setPagination(r.data.pagination); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); setPage(1); }, [filters]);

  const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', '4BHK', 'Villa', 'Penthouse', 'Commercial'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-800 text-white py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">FV</div>
            <span className="text-xl font-extrabold">Floor<span className="text-blue-300">Verse</span></span>
          </Link>
          <h1 className="text-4xl font-extrabold mb-3">Explore Properties in 3D</h1>
          <p className="text-primary-200 text-lg">Walk through floor plans before visiting in person</p>

          {/* Search bar */}
          <div className="mt-8 flex gap-3 max-w-xl mx-auto">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Search city, project, or developer..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium">
            <SlidersHorizontal size={15} /> Filters:
          </div>
          <select className="input text-sm w-auto" value={filters.unitType} onChange={e => setFilters(f => ({ ...f, unitType: e.target.value }))}>
            <option value="">All Unit Types</option>
            {unitTypes.map(t => <option key={t}>{t}</option>)}
          </select>
          <input className="input text-sm w-28" placeholder="City" value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value }))} />
          <input className="input text-sm w-28" placeholder="Min ₹" type="number" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} />
          <input className="input text-sm w-28" placeholder="Max ₹" type="number" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} />
          {(filters.search || filters.city || filters.unitType || filters.minPrice || filters.maxPrice) && (
            <button onClick={() => setFilters({ search: '', city: '', unitType: '', minPrice: '', maxPrice: '' })} className="text-sm text-primary-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Count */}
        {pagination && (
          <p className="text-sm text-gray-500 mb-5">
            {pagination.total} propert{pagination.total !== 1 ? 'ies' : 'y'} found
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Box size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-700">No listings found</h3>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(l => (
              <Link key={l.id} to={`/marketplace/${l.id}`} className="card overflow-hidden hover:shadow-lg transition-all group">
                {/* Thumbnail */}
                <div className="h-44 bg-gradient-to-br from-primary-50 to-primary-100 relative overflow-hidden">
                  {l.thumbnail_url
                    ? <img src={l.thumbnail_url} alt={l.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Box size={32} className="text-primary-400" />
                        <span className="text-xs text-primary-400 font-semibold">3D Floor Plan</span>
                      </div>
                    )
                  }
                  <div className="absolute top-2 left-2 bg-primary-700 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Box size={11} /> 3D
                  </div>
                  {l.unit_type && (
                    <div className="absolute top-2 right-2 bg-white text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {l.unit_type}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-0.5 group-hover:text-primary-700 transition-colors">{l.name}</h3>
                  <p className="text-sm font-medium text-gray-700 mb-1">{l.building_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <MapPin size={11} /> {l.city}{l.state ? `, ${l.state}` : ''}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      {(l.price_min || l.price_max) ? (
                        <p className="text-base font-extrabold text-primary-700">
                          {formatPrice(l.price_min)}{l.price_max && l.price_min !== l.price_max ? ` – ${formatPrice(l.price_max)}` : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">Price on request</p>
                      )}
                      {l.area_sqft && <p className="text-xs text-gray-400">{l.area_sqft} sq.ft</p>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Eye size={11} /> {l.view_count || 0}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => { setPage(p); load(p); }}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${p === page ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-primary-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
