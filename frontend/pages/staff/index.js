import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function StaffDashboard({ user }) {
  // --- STATE 1: SKU SEARCH & FORM ---
  const [skuSearch, setSkuSearch] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [countInput, setCountInput] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);

  // --- STATE 2: HISTORY & UI ---
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/inventory/staff-history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching history:', err);
      setLoading(false);
    }
  };

  // --- HANDLER 1: LOOKUP SKU ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!skuSearch.trim()) return;

    setLoadingLookup(true);
    setLookupResult(null);
    setMessage('');
    setCountInput(''); // Reset count on new search

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/inventory/lookup/${skuSearch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLookupResult(res.data);
    } catch (err) {
      console.error('Lookup error:', err);
      setMessage('SKU not found in Reference Database (ODIN).');
    } finally {
      setLoadingLookup(false);
    }
  };

  // --- HANDLER 2: SUBMIT INVENTORY ---
  const handleSubmit = async () => {
    if (!countInput || !lookupResult) {
      alert('Please enter a count and ensure SKU is looked up.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Construct the "Old" Payload Structure (SKU + Counts + ODIN)
      const payload = {
        skuId: lookupResult.skuId,
        skuName: lookupResult.name || lookupResult.skuName, 
        location: location,
        counts: {
          totalIdentified: parseInt(countInput, 10)
        },
        odin: {
          minQuantity: 0, // Default or derived if you have logic
          maxQuantity: lookupResult.systemQuantity || 0
        },
        // Optional: Pass uniqueCode/pincode if your logic requires it or leave for backend defaults
        notes: notes
      };

      const res = await axios.post('/api/inventory', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status === 'auto-approved') {
        setMessage('Success: Match! Entry Auto-Approved.');
      } else {
        setMessage('Warning: Mismatch. Sent for Client Review.');
      }

      // Reset Form & Refresh History
      setSkuSearch('');
      setLookupResult(null);
      setCountInput('');
      setNotes('');
      fetchHistory(); // <--- Refresh the 3 sections immediately

    } catch (err) {
      console.error('Submit error:', err);
      setMessage('Error submitting entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter sections
  const pendingSection = history.filter(item => item.status === 'pending-client');
  const rejectedSection = history.filter(item => item.status === 'client-rejected');
  const matchedSection = history.filter(item => item.status === 'auto-approved' || item.status === 'client-approved');

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* --- PART 1: SKU LOOKUP FORM (The Old Workflow) --- */}
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6 text-center">Staff Inventory Entry</h2>
          <p className="text-center mb-6 text-gray-500">Welcome, {user.name}</p>
          
          {message && (
            <div className={`mb-4 p-3 rounded text-center ${message.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {message}
            </div>
          )}

          {/* A. SEARCH BAR */}
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Scan or Enter SKU ID..."
              className="flex-1 p-3 border border-gray-300 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loadingLookup}
              className="bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loadingLookup ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* B. LOOKUP RESULT & ENTRY FORM */}
          {lookupResult && (
            <div className="border-t pt-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                
                {/* Left: Reference Data */}
                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-2">ODIN Reference Data</h3>
                  <p><span className="font-semibold">SKU:</span> {lookupResult.skuId}</p>
                  <p><span className="font-semibold">Name:</span> {lookupResult.name}</p>
                  <p><span className="font-semibold">System Qty:</span> {lookupResult.systemQuantity}</p>
                  <p><span className="font-semibold">Location:</span> {lookupResult.pickingLocation || 'N/A'}</p>
                </div>

                {/* Right: Input Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Actual Count</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                      value={countInput}
                      onChange={(e) => setCountInput(e.target.value)}
                      placeholder="Enter quantity found"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Your Location (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Shelf A-1"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                 <label className="block text-gray-700 font-medium mb-1">Notes</label>
                 <textarea 
                    className="w-full p-2 border rounded" 
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                 ></textarea>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Inventory Count'}
              </button>
            </div>
          )}
        </div>

        {/* --- PART 2: HISTORY SECTIONS (The New Requirement) --- */}
        
        {/* SECTION 1: Pending Client Approval */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-400">
          <h3 className="text-xl font-bold mb-4 text-yellow-700">Pending Client Approval</h3>
          {pendingSection.length === 0 ? <p className="text-gray-500">No pending items.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-100"><th className="p-2 text-left">SKU/Bin</th><th className="p-2 text-left">Result</th><th className="p-2 text-left">Date</th></tr></thead>
                <tbody>
                  {pendingSection.map(item => (
                    <tr key={item._id} className="border-b">
                      <td className="p-2">{item.skuId || item.binId}</td>
                      <td className="p-2 text-yellow-600 font-medium">{item.auditResult || 'Mismatch'}</td>
                      <td className="p-2">{new Date(item.timestamps.staffEntry).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: Rejected by Client */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-xl font-bold mb-4 text-red-700">Rejected by Client</h3>
          {rejectedSection.length === 0 ? <p className="text-gray-500">No rejected items.</p> : (
             <div className="overflow-x-auto">
             <table className="min-w-full text-sm">
               <thead><tr className="bg-gray-100"><th className="p-2 text-left">SKU/Bin</th><th className="p-2 text-left">Reason</th></tr></thead>
               <tbody>
                 {rejectedSection.map(item => (
                   <tr key={item._id} className="border-b bg-red-50">
                     <td className="p-2">{item.skuId || item.binId}</td>
                     <td className="p-2 italic">"{item.clientResponse?.comment || 'No comment'}"</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
          )}
        </div>

        {/* SECTION 3: Matched & Submitted */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-xl font-bold mb-4 text-green-700">Matched and Submitted</h3>
          {matchedSection.length === 0 ? <p className="text-gray-500">No matched items.</p> : (
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-100"><th className="p-2 text-left">SKU/Bin</th><th className="p-2 text-left">Status</th></tr></thead>
              <tbody>
                {matchedSection.map(item => (
                  <tr key={item._id} className="border-b">
                    <td className="p-2">{item.skuId || item.binId}</td>
                    <td className="p-2 text-green-600 font-medium">
                      {item.status === 'auto-approved' ? 'Auto Match' : 'Client Approved'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default withAuth(StaffDashboard, 'staff');
