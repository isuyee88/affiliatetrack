import { useQuery } from '@tanstack/react-query';
import { offersApi } from '../lib/api';
import { Link } from 'react-router-dom';

export default function Offers() {
  const { data, isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => offersApi.list(),
  });

  const offers = data?.data?.data || [];

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
        <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
        <Link to="/offers/new" className="btn btn-primary">
          + New Offer
        </Link>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : offers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No offers found. Create your first offer to get started.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Payout</th>
                <th>Type</th>
                <th>Status</th>
                <th>Daily Cap</th>
                <th>Tracking</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer: any) => (
                <tr key={offer.id}>
                  <td className="font-medium">{offer.name}</td>
                  <td>
                    ${offer.payout_value} {offer.payout_currency}
                  </td>
                  <td>
                    <span className="badge badge-info">{offer.payout_type}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(offer.status)}`}>
                      {offer.status}
                    </span>
                  </td>
                  <td>{offer.daily_cap || 'Unlimited'}</td>
                  <td>{offer.conversion_track_method}</td>
                  <td>
                    <div className="flex space-x-2">
                      <Link
                        to={`/offers/${offer.id}`}
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
