import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format } from 'date-fns';

export default function ClicksLog() {
  const [filters, setFilters] = useState({
    start_date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    campaign_id: '',
    country: '',
    device_type: '',
    page: 1,
    per_page: 50,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clicks-log', filters],
    queryFn: () =>
      api.get('/logs/clicks', { params: filters }).then((res) => res.data),
  });

  const clicks = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clicks Log</h1>
        <button
          onClick={() => {
            const url = `/api/logs/clicks/export?start_date=${filters.start_date}&end_date=${filters.end_date}`;
            window.open(url, '_blank');
          }}
          className="btn btn-secondary"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, start_date: e.target.value, page: 1 }))
              }
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, end_date: e.target.value, page: 1 }))
              }
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              value={filters.country}
              onChange={(e) =>
                setFilters((f) => ({ ...f, country: e.target.value, page: 1 }))
              }
              placeholder="e.g., US"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device Type
            </label>
            <select
              value={filters.device_type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, device_type: e.target.value, page: 1 }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Click ID</th>
                <th>Campaign</th>
                <th>Offer</th>
                <th>IP</th>
                <th>Country</th>
                <th>Device</th>
                <th>OS</th>
                <th>Browser</th>
                <th>Bot</th>
                <th>Cost</th>
                <th>Clicked At</th>
              </tr>
            </thead>
            <tbody>
              {clicks.map((click: any) => (
                <tr key={click.id}>
                  <td className="font-mono text-xs">{click.click_id?.substring(0, 12)}...</td>
                  <td>{click.campaign_name || click.campaign_id}</td>
                  <td>{click.offer_name || '-'}</td>
                  <td>{click.ip}</td>
                  <td>{click.country || '-'}</td>
                  <td>{click.device_type || '-'}</td>
                  <td>{click.os || '-'}</td>
                  <td>{click.browser || '-'}</td>
                  <td>
                    {click.is_bot ? (
                      <span className="badge badge-warning">Bot</span>
                    ) : click.is_proxy ? (
                      <span className="badge badge-info">Proxy</span>
                    ) : (
                      <span className="badge badge-success">Clean</span>
                    )}
                  </td>
                  <td>${click.cost?.toFixed(4) || '0.0000'}</td>
                  <td className="text-xs">
                    {click.clicked_at ? format(new Date(click.clicked_at), 'MMM d, HH:mm:ss') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.per_page + 1} to{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} clicks
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                disabled={pagination.page <= 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
