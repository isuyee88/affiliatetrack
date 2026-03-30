import { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Globe, Shield, Star } from 'lucide-react';

interface Domain {
  id: string;
  domain: string;
  type: 'tracker' | 'landing';
  ssl_enabled: boolean;
  is_default: boolean;
  status: 'active' | 'pending' | 'error';
  created_at: string;
}

const mockDomains: Domain[] = [
  { id: '1', domain: 'track.example.com', type: 'tracker', ssl_enabled: true, is_default: true, status: 'active', created_at: '2024-01-15' },
  { id: '2', domain: 'go.example.com', type: 'tracker', ssl_enabled: true, is_default: false, status: 'active', created_at: '2024-01-10' },
  { id: '3', domain: 'landing.example.com', type: 'landing', ssl_enabled: true, is_default: false, status: 'active', created_at: '2024-01-08' },
  { id: '4', domain: 'new.example.com', type: 'tracker', ssl_enabled: false, is_default: false, status: 'pending', created_at: '2024-01-20' },
];

const statusColors = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

export default function Domains() {
  const [searchTerm, setSearchTerm] = useState('');
  const [domains] = useState<Domain[]>(mockDomains);

  const filteredDomains = domains.filter(domain =>
    domain.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage tracker and landing page domains
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Domain
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{domains.length}</div>
          <div className="text-sm text-gray-500">Total Domains</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">
            {domains.filter(d => d.status === 'active').length}
          </div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {domains.filter(d => d.ssl_enabled).length}
          </div>
          <div className="text-sm text-gray-500">SSL Enabled</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">
            {domains.filter(d => d.type === 'tracker').length}
          </div>
          <div className="text-sm text-gray-500">Tracker Domains</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search domains..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Domains Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SSL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDomains.map((domain) => (
                <tr key={domain.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Globe className="w-5 h-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">{domain.domain}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      domain.type === 'tracker' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {domain.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {domain.ssl_enabled ? (
                      <Shield className="w-5 h-5 text-green-500" />
                    ) : (
                      <Shield className="w-5 h-5 text-gray-300" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {domain.is_default ? (
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <Star className="w-5 h-5 text-gray-300" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[domain.status]}`}>
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {domain.created_at}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button className="p-1 rounded hover:bg-gray-100" title="Edit">
                        <Edit className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1 rounded hover:bg-gray-100" title="Delete">
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Domain Setup Instructions */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Domain Setup Instructions</h3>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>Add your domain to Cloudflare and enable proxy (orange cloud)</li>
          <li>Point the domain to your worker URL</li>
          <li>SSL will be automatically enabled by Cloudflare</li>
          <li>Set the domain as default if needed for campaign URLs</li>
        </ol>
      </div>
    </div>
  );
}
