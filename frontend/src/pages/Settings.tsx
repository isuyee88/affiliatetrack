import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
  });

  const user = userData?.data?.user;
  const apiKeys = userData?.data?.api_keys || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile Settings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={user?.name || ''}
              disabled
              className="input bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={user?.role || ''}
              disabled
              className="input bg-gray-50 capitalize"
            />
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <button className="btn btn-primary">Generate New Key</button>
        </div>
        {apiKeys.length === 0 ? (
          <p className="text-gray-500">No API keys generated yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Permissions</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key: any) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    {JSON.parse(key.permissions || '[]').map((p: string) => (
                      <span key={p} className="badge badge-info mr-1">
                        {p}
                      </span>
                    ))}
                  </td>
                  <td>{new Date(key.created_at).toLocaleDateString()}</td>
                  <td>
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td>
                    <button className="text-danger-600 hover:text-danger-800">
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* System Info */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">API Version:</span>
            <span className="ml-2">v1</span>
          </div>
          <div>
            <span className="text-gray-500">Platform:</span>
            <span className="ml-2">Cloudflare Workers</span>
          </div>
          <div>
            <span className="text-gray-500">Database:</span>
            <span className="ml-2">Cloudflare D1</span>
          </div>
          <div>
            <span className="text-gray-500">State:</span>
            <span className="ml-2">Durable Objects</span>
          </div>
        </div>
      </div>
    </div>
  );
}
