import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Flows from './pages/Flows';
import Offers from './pages/Offers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import TrafficSources from './pages/TrafficSources';
import AffiliateNetworks from './pages/AffiliateNetworks';
import ClicksLog from './pages/ClicksLog';
import ConversionsLog from './pages/ConversionsLog';
import Domains from './pages/Domains';

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        
        {/* Campaigns */}
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<Campaigns />} />
        
        {/* Flows */}
        <Route path="/flows" element={<Flows />} />
        <Route path="/flows/:id" element={<Flows />} />
        
        {/* Offers */}
        <Route path="/offers" element={<Offers />} />
        <Route path="/offers/:id" element={<Offers />} />

        {/* Traffic Sources */}
        <Route path="/traffic-sources" element={<TrafficSources />} />
        <Route path="/traffic-sources/:id" element={<TrafficSources />} />

        {/* Affiliate Networks */}
        <Route path="/affiliate-networks" element={<AffiliateNetworks />} />
        <Route path="/affiliate-networks/:id" element={<AffiliateNetworks />} />

        {/* Domains */}
        <Route path="/domains" element={<Domains />} />

        {/* Reports */}
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/overview" element={<Reports />} />
        <Route path="/reports/clicks" element={<ClicksLog />} />
        <Route path="/reports/conversions" element={<ConversionsLog />} />

        {/* Settings */}
        <Route path="/settings" element={<Settings />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
