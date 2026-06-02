import { Link } from 'react-router-dom';
import { Box, Building2, Users, BarChart2, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  const features = [
    { icon: Box,       title: 'Interactive 3D Walkthroughs', desc: 'Buyers navigate floor plans in first-person — no download, no plugin, runs in any browser.' },
    { icon: Building2, title: 'Multi-Project Management',     desc: 'Manage all your buildings and floor plans in one workspace with full team access control.' },
    { icon: Users,     title: 'Lead Capture & CRM',           desc: 'Every 3D view captures qualified buyer interest. Manage all inquiries from one dashboard.' },
    { icon: BarChart2, title: 'Engagement Analytics',         desc: 'See exactly which rooms buyers spend the most time in. Data-driven listing improvements.' },
  ];

  const tiers = [
    { name: 'Starter',   price: '₹2,999', period: '/mo', plans: 5,   highlight: false },
    { name: 'Pro',       price: '₹9,999', period: '/mo', plans: 50,  highlight: true  },
    { name: 'Business',  price: '₹24,999',period: '/mo', plans: '∞', highlight: false },
    { name: 'Enterprise',price: 'Custom', period: '',    plans: '∞', highlight: false },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center text-white font-black text-sm">FV</div>
          <span className="text-xl font-extrabold text-primary-800">Floor<span className="text-primary-500">Verse</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/marketplace" className="text-sm text-gray-600 hover:text-primary-700 font-medium">Marketplace</Link>
          <Link to="/login"    className="btn-secondary btn-sm">Sign In</Link>
          <Link to="/register" className="btn-primary btn-sm">Start Free Trial</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-700 text-white py-24 px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
            <Box size={14} /> Now with Interactive 3D Walkthroughs
          </div>
          <h1 className="text-5xl font-extrabold mb-5 leading-tight">
            Sell Properties Faster with<br />
            <span className="text-blue-300">Immersive 3D Floor Plans</span>
          </h1>
          <p className="text-xl text-primary-200 mb-10 leading-relaxed">
            The SaaS platform for real estate developers to design, publish, and share interactive 3D floor plans — and capture qualified buyers from a single link.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="btn-primary btn-lg bg-white text-primary-800 hover:bg-gray-100">
              Start Free 30-Day Trial <ArrowRight size={18} />
            </Link>
            <Link to="/marketplace" className="btn-secondary btn-lg border-white/30 text-white hover:bg-white/10">
              Browse Marketplace
            </Link>
          </div>
          <p className="text-sm text-primary-300 mt-4">No credit card required · 30-day trial · Cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-12">
            Everything you need to sell smarter
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-6 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <f.icon size={22} className="text-primary-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-3">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 mb-12">Save 20% with annual billing</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {tiers.map(t => (
              <div key={t.name} className={`card p-6 relative ${t.highlight ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}>
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-700 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
                )}
                <p className="font-bold text-gray-900 mb-1">{t.name}</p>
                <p className="text-2xl font-extrabold text-primary-700">{t.price}<span className="text-sm text-gray-400 font-normal">{t.period}</span></p>
                <p className="text-xs text-gray-400 mt-2 mb-4">{t.plans} floor plans</p>
                <Link to="/register" className={`block text-center text-sm font-semibold py-2 rounded-lg transition-colors ${t.highlight ? 'bg-primary-700 text-white hover:bg-primary-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-800 text-white py-16 px-8 text-center">
        <h2 className="text-3xl font-extrabold mb-4">Ready to transform your property sales?</h2>
        <p className="text-primary-200 mb-8">Join 500+ developers already using FloorVerse</p>
        <Link to="/register" className="btn-primary btn-lg bg-white text-primary-800 hover:bg-gray-100">
          Start Free Trial — No Credit Card <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 border-t border-gray-100 text-center text-sm text-gray-400">
        © 2026 FloorVerse. All rights reserved.
      </footer>
    </div>
  );
}
