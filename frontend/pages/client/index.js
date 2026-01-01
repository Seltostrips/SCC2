import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function ClientDashboard({ user }) {
  const [pendingEntries, setPendingEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [rejectionComment, setRejectionComment] = useState('');
  const [loading, setLoading] = useState(true);

  // Helper to handle API URLs safely
  const getApiUrl = (endpoint) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  };

  useEffect(() => {
    if (user) {
      fetchPendingEntries();
    }
  }, [user]);

  const fetchPendingEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(getApiUrl('/api/inventory/pending'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingEntries(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pending:', err);
      setLoading(false);
    }
  };

  const handleResponse = async (action) => {
    if (action === 'rejected' && !rejectionComment.trim()) {
      return alert('Please provide a reason for rejection.');
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(getApiUrl(`/api/inventory/${selectedEntry._id}/respond`), {
        action,
        comment: rejectionComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Remove from list and reset view
      setPendingEntries(prev => prev.filter(e => e._id !== selectedEntry._id));
      setSelectedEntry(null);
      setRejectionComment('');
      alert(action === 'approved' ? 'Item Approved!' : 'Item Rejected.');
    } catch (err) {
      console.error('Error responding:', err);
      alert('Failed to submit response.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Client Approval Dashboard</h1>
        
        {/* User Info Bar */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Welcome,</p>
            <p className="font-bold text-lg text-indigo-600">{user?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Location:</p>
            {/* Show all locations if array, or legacy string */}
            <p className="font-medium">
                {user?.locations?.length > 0 ? user.locations.join(', ') : (user?.mappedLocation || 'N/A')}
            </p>
          </div>
        </div>
        
        {selectedEntry ? (
          /* --- DETAIL VIEW (REVIEW MODE) --- */
          <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-bold">{selectedEntry.skuId}</h2>
                <p className="text-indigo-100 text-sm">{selectedEntry.skuName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Location</p>
                <p className="font-mono font-bold">{selectedEntry.location}</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* LEFT: STAFF COUNT BREAKDOWN */}
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Physical Count (Staff)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Picking:</span> <b>{selectedEntry.counts?.picking || 0}</b></div>
                  <div className="flex justify-between"><span>Bulk:</span> <b>{selectedEntry.counts?.bulk || 0}</b></div>
                  <div className="flex justify-between"><span>Near Expiry:</span> <b>{selectedEntry.counts?.nearExpiry || 0}</b></div>
                  <div className="flex justify-between"><span>JIT:</span> <b>{selectedEntry.counts?.jit || 0}</b></div>
                  <div className="flex justify-between"><span>Damaged:</span> <b>{selectedEntry.counts?.damaged || 0}</b></div>
                  <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base text-indigo-700 font-bold">
                    <span>Total Found:</span>
                    <span>{selectedEntry.counts?.totalIdentified || 0}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: SYSTEM/ODIN DATA */}
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">System Data (ODIN)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Min Qty (ODIN):</span> <b>{selectedEntry.odin?.minQuantity || 0}</b></div>
                  <div className="flex justify-between"><span>Blocked Qty:</span> <b>{selectedEntry.odin?.blocked || 0}</b></div>
                  <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base text-gray-800 font-bold">
                    <span>System Total:</span>
                    <span>{selectedEntry.odin?.maxQuantity || 0}</span>
                  </div>
                </div>
                
                {/* DISCREPANCY BOX */}
                <div className={`mt-6 p-3 rounded text-center font-bold border ${
                   (selectedEntry.counts?.totalIdentified - selectedEntry.odin?.maxQuantity) === 0 
                   ? 'bg-green-100 text-green-800 border-green-200' 
                   : 'bg-red-100 text-red-800 border-red-200'
                }`}>
                   Discrepancy: {selectedEntry.counts?.totalIdentified - selectedEntry.odin?.maxQuantity}
                   <div className="text-xs font-normal mt-1 uppercase">{selectedEntry.auditResult}</div>
                </div>
              </div>
            </div>

            {/* STAFF INFO & NOTES */}
            <div className="px-6 pb-6">
               <div className="text-sm text-gray-500 mb-2">
                  <span className="font-bold mr-2">Submitted By:</span> 
                  {selectedEntry.staffId?.name || 'Unknown Staff'} 
                  <span className="mx-2">•</span>
                  {new Date(selectedEntry.timestamps?.staffEntry).toLocaleString()}
               </div>
               {selectedEntry.notes && (
                 <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-sm text-yellow-800 mb-4">
                    <span className="font-bold block mb-1">Staff Notes:</span>
                    "{selectedEntry.notes}"
                 </div>
               )}
            </div>

            {/* ACTIONS */}
            <div className="bg-gray-100 px-6 py-4 border-t border-gray-200">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Rejection Reason (If rejecting)</label>
                <textarea
                  value={rejectionComment}
                  onChange={(e) => setRejectionComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  rows="2"
                  placeholder="Enter comment here..."
                ></textarea>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleResponse('approved')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded shadow transition"
                >
                  ✔ Approve Discrepancy
                </button>
                <button
                  onClick={() => handleResponse('rejected')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded shadow transition"
                >
                  ✖ Reject Entry
                </button>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* --- LIST VIEW --- */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {pendingEntries.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">All Caught Up!</h3>
                <p className="mt-1 text-sm text-gray-500">No pending discrepancies to review.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">System Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Physical Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diff</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingEntries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{entry.skuId}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{entry.skuName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.odin?.maxQuantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{entry.counts?.totalIdentified}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                        {entry.counts?.totalIdentified - entry.odin?.maxQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className="text-indigo-600 hover:text-indigo-900 font-bold"
                        >
                          Review &gt;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(ClientDashboard, 'client');
