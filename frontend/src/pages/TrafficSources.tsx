import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function TrafficSources() {
  const { data, isLoading } = useQuery({
    queryKey: ['traffic-sources'],
    queryFn: () => api.get('/traffic-sources').then((res) => res.data),
  });

  const sources = data?.data?.data || [];

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
        <h1 className="text-2xl font-bold text-gray-900">Traffic Sources</h1>
        <Link to="/traffic-sources/new" className="btn btn-primary">
          + New Traffic Source
        </Link>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No traffic sources found. Create your first traffic source to get started.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Template</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Conversions</th>
                <th>Revenue</th>
                <th>ROI</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source: any) => (
                <tr key={source.id}>
                  <td className="font-medium">{source.name}</td>
                  <td>{source.template || '-'}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(source.status)}`}>
                      {source.status}
                    </span>
                  </td>
                  <td>{source.total_clicks?.toLocaleString() || 0}</td>
                  <td>{source.total_conversions?.toLocaleString() || 0}</td>
                  <td>${source.total_revenue?.toFixed(2) || '0.00'}</td>
                  <td className={source.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {source.roi?.toFixed(1) || 0}%
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <Link
                        to={`/traffic-sources/${source.id}`}
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
