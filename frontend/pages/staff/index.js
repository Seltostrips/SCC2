import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function StaffDashboard() {
  const [location, setLocation] = useState('');
  
  // Step 1: Search
  const [skuInput, setSkuInput] = useState('');
  const [skuData, setSkuData] = useState(null);
  
  // Step 2: Audit
  const [counts, setCounts] = useState({ picking: 0, bulk: 0, nearExpiry: 0, jit: 0, damaged: 0 });
  const [odin, setOdin] = useState({ min: 0, blocked: 0 });
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    setLocation(localStorage.getItem('activeLocation') || 'Unknown Location');
  }, []);

  const fetchSku = async () => {
    if (!skuInput) return alert("Please enter an SKU ID");

    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      console.log(`Searching for SKU: ${skuInput} at ${baseUrl}/api/inventory/lookup/${skuInput}`);

      const res = await axios.get(`${baseUrl}/api/inventory/lookup/${skuInput}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("SKU Found:", res.data);
      setSkuData(res.data);
      
      // Fetch Clients for Dropdown
      const clientRes = await axios.get(`${baseUrl}/api/inventory/clients-by-location?location=${location}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(clientRes.data);

    } catch (err) {
      console.error("Lookup Error:", err);
      // DETAILED ERROR MESSAGE
      if (err.response) {
        if (err.response.status === 404) alert(`SKU "${skuInput}" not found in Database.`);
        else alert(`Server Error (${err.response.status}): ${err.response.data?.message || err.message}`);
      } else {
        alert(`Connection Error: ${err.message}. Check if Backend is running.`);
      }
    }
  };

  const handleSubmit = async () => {
    const total = Object.values(counts).reduce((a, b) => Number(a) + Number(b), 0);
    const maxOdin = Number(odin.min) + Number(odin.blocked);
    const isExcess = total > maxOdin;
    const isShortfall = total < Number(odin.min);
    const isDiscrepancy = isExcess || isShortfall;

    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      await axios.post(`${baseUrl}/api/inventory`, {
        skuId: skuData.skuId,
        skuName: skuData.name,
        location,
        counts: { ...counts, totalIdentified: total },
        odin: { minQuantity: odin.min, blockedQuantity: odin.blocked, maxQuantity: maxOdin },
        assignedClientId: selectedClient
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(isDiscrepancy ? 'Objection Raised to Client!' : 'Audit Approved!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Submission Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // --- RENDER ---
  if (!skuData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <h1 className="text-xl font-bold mb-4 text-center">Audit Entry: {location}</h1>
          <label className="block text-gray-700 font-bold mb-2">Enter SKU ID</label>
          <div className="flex gap-2">
            <input 
              className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500" 
              value={skuInput} 
              placeholder="e.g. 328721"
              onChange={e => setSkuInput(e.target.value)} 
            />
            <button onClick={fetchSku} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Audit Form (Only shows after SKU found)
  const total = Object.values(counts).reduce((a, b) => Number(a) + Number(b), 0);
  const maxOdin = Number(odin.min) + Number(odin.blocked);
  const isDiscrepancy = total > maxOdin || total < Number(odin.min);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
        <button onClick={() => window.location.reload()} className="text-sm text-gray-500 mb-4">&larr; Back</button>
        
        <div className="bg-indigo-50 p-4 rounded mb-6 border border-indigo-100">
          <h2 className="text-2xl font-bold text-indigo-900">{skuData.name}</h2>
          <div className="flex gap-6 mt-2 text-indigo-700">
            <p><strong>SKU:</strong> {skuData.skuId}</p>
            <p><strong>Picking Loc:</strong> {skuData.pickingLocation}</p>
            <p><strong>Bulk Loc:</strong> {skuData.bulkLocation}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Physical Counts */}
          <div className="space-y-3">
            <h3 className="font-bold border-b pb-2">Physical Count</h3>
            {Object.keys(counts).map(k => (
              <div key={k} className="flex justify-between items-center">
                <label className="capitalize text-gray-600">{k.replace(/([A-Z])/g, ' $1')}</label>
                <input 
                  type="number" 
                  className="border p-1 w-20 text-center rounded"
                  value={counts[k]}
                  onChange={e => setCounts({...counts, [k]: e.target.value})}
                />
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total Identified</span>
              <span>{total}</span>
            </div>
          </div>

          {/* ODIN Data */}
          <div className="space-y-3 bg-yellow-50 p-4 rounded h-fit">
            <h3 className="font-bold border-b pb-2 text-yellow-800">ODIN System Data</h3>
            <div>
              <label className="text-sm">Minimum Quantity</label>
              <input type="number" className="w-full border p-1 rounded" 
                value={odin.min} onChange={e => setOdin({...odin, min: e.target.value})} />
            </div>
            <div>
              <label className="text-sm">Blocked Quantity</label>
              <input type="number" className="w-full border p-1 rounded" 
                value={odin.blocked} onChange={e => setOdin({...odin, blocked: e.target.value})} />
            </div>
            <p className="font-bold text-right pt-2">Max Limit: {maxOdin}</p>
          </div>
        </div>

        {/* Discrepancy Section */}
        {isDiscrepancy ? (
          <div className="bg-red-50 p-4 rounded border border-red-200 mb-6">
            <p className="text-red-700 font-bold text-lg mb-2">
              ⚠️ Audit Mismatch: {total > maxOdin ? 'EXCESS' : 'SHORTFALL'}
            </p>
            <label className="block mb-1 text-sm font-medium">Assign to Client for Review:</label>
            <select 
              className="w-full border p-2 rounded"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">-- Select Client Staff --</option>
              {clients.map(c => (
                <option key={c._id} value={c._id}>{c.name} ({c.mappedLocation})</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-green-100 p-4 rounded text-green-800 font-bold text-center mb-6">
            ✅ Quantities Match. Ready to Approve.
          </div>
        )}

        <button 
          onClick={handleSubmit} 
          disabled={isDiscrepancy && !selectedClient}
          className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 disabled:bg-gray-400 transition"
        >
          Submit Audit Entry
        </button>
      </div>
    </div>
  );
}

export default withAuth(StaffDashboard, 'staff');
