import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Pages
import LandingPage      from './pages/Landing/LandingPage';
import LoginPage        from './pages/Auth/LoginPage';
import RegisterPage     from './pages/Auth/RegisterPage';
import DashboardPage    from './pages/Dashboard/DashboardPage';
import BuildingsPage    from './pages/Buildings/BuildingsPage';
import FloorPlansPage   from './pages/FloorPlan/FloorPlansPage';
import FloorPlanEditor  from './pages/FloorPlan/FloorPlanEditor';
import ViewerPage       from './pages/Viewer/ViewerPage';
import MarketplacePage  from './pages/Marketplace/MarketplacePage';
import ListingPage      from './pages/Marketplace/ListingPage';
import LeadsPage        from './pages/Leads/LeadsPage';
import DashboardLayout  from './components/Layout/DashboardLayout';
import ProtectedRoute   from './router/ProtectedRoute';

function App() {
  const init = useAuthStore(s => s.init);

  useEffect(() => { init(); }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"            element={<LandingPage />} />
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"    element={<RegisterPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/:id" element={<ListingPage />} />
        <Route path="/viewer/:id"  element={<ViewerPage />} />

        {/* Protected tenant routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/buildings"  element={<BuildingsPage />} />
            <Route path="/floor-plans" element={<FloorPlansPage />} />
            <Route path="/leads"       element={<LeadsPage />} />
          </Route>
          <Route path="/editor/:id"   element={<FloorPlanEditor />} />
          <Route path="/editor/new"   element={<FloorPlanEditor />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
