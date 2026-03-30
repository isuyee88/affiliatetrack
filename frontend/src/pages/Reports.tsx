import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api';
import { format, subDays } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [groupBy, setGroupBy] = useState<'date' | 'campaign' | 'offer' | 'country'>('date');

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', dateRange, groupBy],
    queryFn: () => reportsApi.byDate(dateRange),
  });

  const { data: overviewData } = useQuery({
    queryKey: ['overview', dateRange],
    queryFn: () => reportsApi.overview(dateRange),
  });

  const summary = overviewData?.data?.summary;
  const data = reportData?.data?.data || [];

  const handleExport = async () => {
    const response = await reportsApi.export(dateRange);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${dateRange.start_date}_${dateRange.end_date}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button onClick={handleExport} className="btn btn-secondary">
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start_date: e.target.value }))
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
              value={dateRange.end_date}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end_date: e.target.value }))
              }
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="input"
            >
              <option value="date">Date</option>
              <option value="campaign">Campaign</option>
              <option value="offer">Offer</option>
              <option value="country">Country</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Total Clicks</div>
          <div className="text-2xl font-bold">
            {summary?.total_clicks?.toLocaleString() || 0}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Conversions</div>
          <div className="text-2xl font-bold">
            {summary?.total_conversions?.toLocaleString() || 0}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Revenue</div>
          <div className="text-2xl font-bold">
            ${summary?.total_revenue?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Profit</div>
          <div className="text-2xl font-bold text-green-600">
            ${summary?.total_profit?.toFixed(2) || '0.00'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                stroke="#9ca3af"
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
              <Line
                type="monotone"
                dataKey="conversions"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e' }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Data</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Conversions</th>
                <th>CVR</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, index: number) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td>{row.impressions?.toLocaleString()}</td>
                  <td>{row.clicks?.toLocaleString()}</td>
                  <td>{row.ctr?.toFixed(2)}%</td>
                  <td>{row.conversions?.toLocaleString()}</td>
                  <td>{row.cvr?.toFixed(2)}%</td>
                  <td>${row.revenue?.toFixed(2)}</td>
                  <td>${row.cost?.toFixed(2)}</td>
                  <td
                    className={
                      row.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    ${row.profit?.toFixed(2)}
                  </td>
                  <td
                    className={
                      row.roi >= 0 ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {row.roi?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
