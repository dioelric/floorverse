import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    companyName: '', role: 'tenant_admin',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm">FV</div>
            <span className="text-2xl font-extrabold text-white">Floor<span className="text-blue-300">Verse</span></span>
          </Link>
          <p className="mt-2 text-primary-200 text-sm">Start your 30-day free trial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input className="input" required placeholder="Rajan" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" required placeholder="Mehta" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Company / Firm name</label>
              <input className="input" required placeholder="Mehta Realty Pvt Ltd" value={form.companyName} onChange={e => set('companyName', e.target.value)} />
            </div>

            <div>
              <label className="label">Work email</label>
              <input type="email" className="input" required placeholder="rajan@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            <div>
              <label className="label">Password</label>
              <input type="password" className="input" required minLength={8} placeholder="Min 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>

            <div>
              <label className="label">I am a...</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="tenant_admin">Real Estate Developer</option>
                <option value="designer">Architect / Designer</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="consumer">Home Buyer (Consumer)</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg justify-center mt-2">
              {loading
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><UserPlus size={18} /> Create Account</>
              }
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-700 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
