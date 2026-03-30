import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format } from 'date-fns';

export default function ConversionsLog() {
  const [filters, setFilters] = useState({
    start_date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    status: '',
    conversion_type: '',
    page: 1,
    per_page: 50,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['conversions-log', filters],
    queryFn: () =>
      api.get('/logs/conversions', { params: filters }).then((res) => res.data),
  });

  const conversions = data?.data || [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      approved: 'badge-success',
      pending: 'badge-warning',
      rejected: 'badge-danger',
      duplicate: 'badge-info',
    };
    return classes[status] || 'badge-info';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Conversions Log</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Total Conversions</div>
          <div className="text-2xl font-bold">{summary.total_conversions || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Approved</div>
          <div className="text-2xl font-bold text-green-600">{summary.approved_count || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold">${summary.total_revenue?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Total Profit</div>
          <div className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${summary.total_profit?.toFixed(2) || '0.00'}
          </div>
        </div>
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
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="duplicate">Duplicate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.conversion_type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, conversion_type: e.target.value, page: 1 }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="lead">Lead</option>
              <option value="sale">Sale</option>
              <option value="signup">Signup</option>
              <option value="install">Install</option>
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
                <th>Conversion ID</th>
                <th>Click ID</th>
                <th>Campaign</th>
                <th>Offer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Converted At</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((conv: any) => (
                <tr key={conv.id}>
                  <td className="font-mono text-xs">{conv.conversion_id?.substring(0, 12)}...</td>
                  <td className="font-mono text-xs">{conv.click_id?.substring(0, 12)}...</td>
                  <td>{conv.campaign_name || conv.campaign_id}</td>
                  <td>{conv.offer_name || '-'}</td>
                  <td>
                    <span className="badge badge-info">{conv.conversion_type}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(conv.status)}`}>
                      {conv.status}
                    </span>
                  </td>
                  <td className="text-green-600">${conv.revenue?.toFixed(2)}</td>
                  <td className="text-red-600">${conv.cost?.toFixed(2)}</td>
                  <td className={conv.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${conv.profit?.toFixed(2)}
                  </td>
                  <td className="text-xs">
                    {conv.converted_at ? format(new Date(conv.converted_at), 'MMM d, HH:mm:ss') : '-'}
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
              {pagination.total} conversions
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
