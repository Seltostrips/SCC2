import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function StaffDashboard({ user }) {
  // --- STATE ---
  const [skuSearch, setSkuSearch] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  
  // Detailed Counts
  const [counts, setCounts] = useState({
    picking: 0, bulk: 0, nearExpiry: 0, jit: 0, damaged: 0
  });
  
  // ODIN Inputs
  const [odinInputs, setOdinInputs] = useState({
    minQuantity: 0, // "Enter Quantity as per ODIN"
    blocked: 0      // "Enter Blocked Quantity"
  });

  // Client Selection (For Discrepancies)
  const [availableClients, setAvailableClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  
  // UI State
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);

  // URL Helper
  const getApiUrl = (endpoint) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Fetch clients whenever Location changes
  useEffect(() => {
    if (location && location.length > 2) {
      fetchClientsByLocation(location);
    }
  }, [location]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(getApiUrl('/api/inventory/staff-history'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchClientsByLocation = async (loc) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(getApiUrl(`/api/inventory/clients-by-location?location=${loc}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableClients(res.data);
    } catch (err) { console.error('Error fetching clients:', err); }
  };

  // --- CALCULATIONS ---
  const totalIdentified = 
    (parseInt(counts.picking) || 0) + 
    (parseInt(counts.bulk) || 0) + 
    (parseInt(counts.nearExpiry) || 0) + 
    (parseInt(counts.jit) || 0) + 
    (parseInt(counts.damaged) || 0);

  const totalSystem = 
    (parseInt(odinInputs.minQuantity) || 0) + 
    (parseInt(odinInputs.blocked) || 0);

  const discrepancy = totalIdentified - totalSystem;
  let auditStatus = 'Match';
  if (discrepancy > 0) auditStatus = 'Excess';
  if (discrepancy < 0) auditStatus = 'Shortfall';

  // --- HANDLERS ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!skuSearch.trim()) return;
    setLoadingLookup(true);
    setLookupResult(null);
    setMessage('');
    
    // Reset form
    setCounts({ picking: 0, bulk: 0, nearExpiry: 0, jit: 0, damaged: 0 });
    setOdinInputs({ minQuantity: 0, blocked: 0 });
    setSelectedClientId('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(getApiUrl(`/api/inventory/lookup/${skuSearch}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLookupResult(res.data);
      // Auto-populate location if available in ODIN
      if (res.data.pickingLocation) setLocation(res.data.pickingLocation);
    } catch (err) {
      setMessage('SKU not found in Reference Database.');
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleSubmit = async (isObjection) => {
    if (isObjection && !selectedClientId) {
      alert('Please select a client staff member to raise an objection.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        skuId: lookupResult.skuId,
        skuName: lookupResult.name,
        location,
        counts,
        odin: odinInputs,
        assignedClientId: isObjection ? selectedClientId : null,
        notes
      };

      const res = await axios.post(getApiUrl('/api/inventory'), payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage(isObjection ? 'Objection Raised! Sent to Client.' : 'Success! Entry Auto-Approved.');
      
      // Clear form
      setSkuSearch('');
      setLookupResult(null);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setMessage('Error submitting entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER HELPERS ---
  const pendingSection = history.filter(item => item.status === 'pending-client');
  const rejectedSection = history.filter(item => item.status === 'client-rejected');
  const matchedSection = history.filter(item => item.status === 'auto-approved' || item.status === 'client-approved');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* === PART 1: MAIN FORM === */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Staff Inventory Entry</h2>
          
          {message && (
            <div className={`mb-4 p-3 rounded text-center font-bold ${message.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {message}
            </div>
          )}

          {/* SEARCH */}
          <form onSubmit={handleSearch} className="flex gap-4 mb-6 border-b pb-6">
            <input
              type="text"
              placeholder="Scan or Enter SKU ID..."
              className="flex-1 p-3 border border-gray-300 rounded text-lg"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loadingLookup}
              className="bg-indigo-600 text-white px-8 py-3 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loadingLookup ? '...' : 'Search'}
            </button>
          </form>

          {/* FORM AREA */}
          {lookupResult && (
            <div className="animate-fade-in space-y-6">
              
              {/* Info Header */}
              <div className="bg-blue-50 p-4 rounded grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-900">
                <div><span className="font-bold">Name:</span> {lookupResult.name}</div>
                <div><span className="font-bold">System Qty:</span> {lookupResult.systemQuantity}</div>
                <div>
                  <span className="font-bold">Location:</span> 
                  <input 
                    type="text" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)}
                    className="ml-2 p-1 border rounded w-32"
                    placeholder="Enter Loc"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* LEFT: STAFF COUNTS */}
                <div className="bg-gray-50 p-4 rounded border">
                  <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">1. Physical Count</h3>
                  <div className="space-y-3">
                    {['picking', 'bulk', 'nearExpiry', 'jit', 'damaged'].map(field => (
                      <div key={field} className="flex justify-between items-center">
                        <label className="capitalize text-gray-600 w-1/2">{field.replace(/([A-Z])/g, ' $1').trim()}</label>
                        <input 
                          type="number" 
                          min="0"
                          value={counts[field]}
                          onChange={e => setCounts({...counts, [field]: parseInt(e.target.value) || 0})}
                          className="w-24 p-2 border rounded text-right font-mono"
                        />
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 border-t font-bold text-lg">
                      <span>Total Identified:</span>
                      <span className="text-indigo-600">{totalIdentified}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: ODIN INPUTS */}
                <div className="bg-gray-50 p-4 rounded border">
                  <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">2. ODIN Data</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-gray-600 w-1/2">Qty per ODIN (Min)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={odinInputs.minQuantity}
                        onChange={e => setOdinInputs({...odinInputs, minQuantity: parseInt(e.target.value) || 0})}
                        className="w-24 p-2 border rounded text-right font-mono"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="text-gray-600 w-1/2">Blocked Qty</label>
                      <input 
                        type="number" 
                        min="0"
                        value={odinInputs.blocked}
                        onChange={e => setOdinInputs({...odinInputs, blocked: parseInt(e.target.value) || 0})}
                        className="w-24 p-2 border rounded text-right font-mono"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t font-bold text-lg">
                      <span>Maximum (Sum):</span>
                      <span className="text-indigo-600">{totalSystem}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION AREA */}
              <div className={`p-4 rounded border-2 ${auditStatus === 'Match' ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold">Audit Status: <span className={auditStatus === 'Match' ? 'text-green-600' : 'text-red-600'}>{auditStatus}</span></span>
                  {auditStatus !== 'Match' && (
                     <span className="text-sm text-red-600 font-semibold">({Math.abs(discrepancy)} {auditStatus})</span>
                  )}
                </div>

                {/* BUTTONS LOGIC */}
                {auditStatus === 'Match' ? (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 shadow"
                  >
                    Match! Submit (Auto-Approve)
                  </button>
                ) : (
                  <div className="space-y-3">
                     <div>
                        <label className="block text-sm font-bold text-red-700 mb-1">Select Client Staff to Raise Objection:</label>
                        <select 
                          className="w-full p-2 border border-red-300 rounded"
                          value={selectedClientId}
                          onChange={e => setSelectedClientId(e.target.value)}
                        >
                          <option value="">-- Select Client Mapped to "{location}" --</option>
                          {availableClients.map(c => (
                            <option key={c._id} value={c._id}>{c.name} ({c.company})</option>
                          ))}
                        </select>
                        {availableClients.length === 0 && (
                          <p className="text-xs text-red-500 mt-1">* No clients found for location "{location}". Check spelling or backend mapping.</p>
                        )}
                     </div>
                     <button
                        onClick={() => handleSubmit(true)}
                        disabled={isSubmitting}
                        className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 shadow"
                     >
                        Raise Objection to Client
                     </button>
                  </div>
                )}
              </div>

              {/* NOTES */}
              <textarea
                placeholder="Optional notes..."
                className="w-full p-2 border rounded"
                rows="2"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              ></textarea>

            </div>
          )}
        </div>

        {/* === PART 2: HISTORY SECTIONS === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending */}
            <div className="bg-white p-4 rounded shadow border-t-4 border-yellow-400">
                <h3 className="font-bold text-yellow-700 mb-2">Pending Approval</h3>
                {pendingSection.length === 0 ? <p className="text-xs text-gray-400">None</p> : (
                    <ul className="text-sm space-y-2">
                        {pendingSection.map(i => (
                            <li key={i._id} className="flex justify-between border-b pb-1">
                                <span>{i.skuId}</span>
                                <span className="font-mono text-yellow-600">{i.auditResult}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Rejected */}
            <div className="bg-white p-4 rounded shadow border-t-4 border-red-500">
                <h3 className="font-bold text-red-700 mb-2">Rejected by Client</h3>
                {rejectedSection.length === 0 ? <p className="text-xs text-gray-400">None</p> : (
                    <ul className="text-sm space-y-2">
                        {rejectedSection.map(i => (
                            <li key={i._id} className="border-b pb-1">
                                <div className="flex justify-between font-bold">
                                    <span>{i.skuId}</span>
                                </div>
                                <div className="text-xs text-red-500 italic">"{i.clientResponse?.comment}"</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Matched */}
            <div className="bg-white p-4 rounded shadow border-t-4 border-green-500">
                <h3 className="font-bold text-green-700 mb-2">Matched / Approved</h3>
                {matchedSection.length === 0 ? <p className="text-xs text-gray-400">None</p> : (
                    <ul className="text-sm space-y-2">
                         {matchedSection.map(i => (
                            <li key={i._id} className="flex justify-between border-b pb-1">
                                <span>{i.skuId}</span>
                                <span className="text-green-600 text-xs">{i.status === 'auto-approved' ? 'Auto' : 'Client'}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}

export default withAuth(StaffDashboard, 'staff');
