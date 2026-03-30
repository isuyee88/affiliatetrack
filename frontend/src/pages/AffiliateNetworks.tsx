import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function AffiliateNetworks() {
  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-networks'],
    queryFn: () => api.get('/affiliate-networks').then((res) => res.data),
  });

  const networks = data?.data?.data || [];

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      paused: 'badge-warning',
      deleted: 'badge-danger',
    };
    return classes[status] || 'badge-info';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Networks</h1>
        <Link to="/affiliate-networks/new" className="btn btn-primary">
          + New Affiliate Network
        </Link>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : networks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No affiliate networks found. Create your first network to get started.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Template</th>
                <th>Offers</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Conversions</th>
                <th>Revenue</th>
                <th>ROI</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((network: any) => (
                <tr key={network.id}>
                  <td className="font-medium">{network.name}</td>
                  <td>{network.template || '-'}</td>
                  <td>{network.offers_count || 0}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(network.status)}`}>
                      {network.status}
                    </span>
                  </td>
                  <td>{network.total_clicks?.toLocaleString() || 0}</td>
                  <td>{network.total_conversions?.toLocaleString() || 0}</td>
                  <td>${network.total_revenue?.toFixed(2) || '0.00'}</td>
                  <td className={network.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {network.roi?.toFixed(1) || 0}%
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <Link
                        to={`/affiliate-networks/${network.id}`}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        Edit
                      </Link>
                      <button className="text-primary-600 hover:text-primary-800">
                        Postback URL
                      </button>
                      <button className="text-danger-600 hover:text-danger-800">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Templates Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Templates
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          Pre-configured templates for popular affiliate networks. Select a template when creating a new network for quick setup.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['ClickDealer', 'MaxBounty', 'CPA Grip', 'Offer365', 'Traffic Light'].map((name) => (
            <div key={name} className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium">{name}</div>
              <div className="text-sm text-gray-500">Pre-configured postback macros</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
