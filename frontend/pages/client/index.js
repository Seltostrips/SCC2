import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function ClientDashboard({ user }) {
  const [pendingEntries, setPendingEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [rejectionComment, setRejectionComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchPendingEntries();
    
    // Initialize socket connection
    if (typeof window !== 'undefined') {
      import('socket.io-client').then((ioModule) => {
        const newSocket = ioModule.default(process.env.NEXT_PUBLIC_API_URL);
        setSocket(newSocket);
        
        // Join client room
        newSocket.emit('join-room', 'client');
        
        // Listen for new pending entries for this specific client
        newSocket.on(`new-pending-entry-${user._id}`, (entry) => {
          console.log('New pending entry received:', entry);
          setPendingEntries(prev => [entry, ...prev]);
          alert('New inventory entry requires your review!');
        });
        
        return () => {
          newSocket.disconnect();
        };
      });
    }
  }, [user._id]);

  const fetchPendingEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/inventory/pending', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Pending entries:', res.data);
      setPendingEntries(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pending entries:', err);
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/inventory/${selectedEntry._id}/respond`, {
        action: 'approved'
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setPendingEntries(pendingEntries.filter(entry => entry._id !== selectedEntry._id));
      setSelectedEntry(null);
    } catch (err) {
      console.error('Error accepting entry:', err);
    }
  };

  const handleReject = async () => {
    if (!rejectionComment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/inventory/${selectedEntry._id}/respond`, {
        action: 'rejected',
        comment: rejectionComment
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setPendingEntries(pendingEntries.filter(entry => entry._id !== selectedEntry._id));
      setSelectedEntry(null);
      setRejectionComment('');
    } catch (err) {
      console.error('Error rejecting entry:', err);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Client Dashboard</h1>
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="font-medium">Company: {user.company}</p>
          <p className="font-medium">Unique Code: {user.uniqueCode}</p>
          <p className="font-medium">Location: {user.location.city}, {user.location.pincode}</p>
        </div>
        
        {selectedEntry ? (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Entry Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Bin ID</p>
                <p className="font-medium">{selectedEntry.binId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Book Quantity</p>
                <p className="font-medium">{selectedEntry.bookQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Count</p>
                <p className="font-medium">{selectedEntry.actualQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Discrepancy</p>
                <p className="font-medium">{selectedEntry.discrepancy}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Staff</p>
                <p className="font-medium">{selectedEntry.staffId?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{selectedEntry.location || 'N/A'}</p>
              </div>
            </div>
            
            {selectedEntry.notes && (
              <div className="mb-6">
                <p className="text-sm text-gray-500">Staff Notes</p>
                <p className="font-medium">{selectedEntry.notes}</p>
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (required if rejecting)
              </label>
              <textarea
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows="3"
                placeholder="Please provide a reason for rejection"
              ></textarea>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleAccept}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Accept
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedEntry(null)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {pendingEntries.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No pending entries to review</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bin ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Qty</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Qty</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.binId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.bookQuantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.actualQuantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.staffId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Review
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
