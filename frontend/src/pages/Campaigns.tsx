import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../lib/api';
import { Link } from 'react-router-dom';

export default function Campaigns() {
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const campaigns = data?.data?.data || [];

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
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <Link to="/campaigns/new" className="btn btn-primary">
          + New Campaign
        </Link>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No campaigns found. Create your first campaign to get started.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Distribution</th>
                <th>Budget</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign: any) => (
                <tr key={campaign.id}>
                  <td className="font-medium">{campaign.name}</td>
                  <td>
                    <span className="badge badge-info">{campaign.type}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td>{campaign.distribution_type}</td>
                  <td>
                    {campaign.daily_budget
                      ? `$${campaign.daily_budget}/day`
                      : 'Unlimited'}
                  </td>
                  <td>
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        Edit
                      </Link>
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
    </div>
  );
}
