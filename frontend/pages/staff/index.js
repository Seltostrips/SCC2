import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function StaffDashboard() {
  const [location, setLocation] = useState('');
  const [skuId, setSkuId] = useState('');
  const [skuData, setSkuData] = useState(null);
  const [counts, setCounts] = useState({ picking: 0, bulk: 0, nearExpiry: 0, jit: 0, damaged: 0 });
  const [odin, setOdin] = useState({ min: 0, blocked: 0 });
  
  // Logic helpers
  const total = Object.values(counts).reduce((a, b) => Number(a) + Number(b), 0);
  const maxOdin = Number(odin.min) + Number(odin.blocked);
  const isExcess = total > maxOdin;
  const isShortfall = total < Number(odin.min);
  const isDiscrepancy = isExcess || isShortfall;

  // Client Selection
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    const loc = localStorage.getItem('activeLocation');
    setLocation(loc);
  }, []);

  const fetchSku = async () => {
    try {
      const token = localStorage.getItem('token');
      // You'll need to add this route to inventory.js on backend
      const res = await axios.get(`/api/inventory/lookup/${skuId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSkuData(res.data);
      
      // Fetch available clients for this location
      const clientRes = await axios.get(`/api/inventory/clients?location=${location}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(clientRes.data);
    } catch (err) {
      alert('SKU Not Found');
    }
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/inventory', {
        skuId,
        skuName: skuData.name,
        location,
        counts: { ...counts, totalIdentified: total },
        odin: { minQuantity: odin.min, blockedQuantity: odin.blocked, maxQuantity: maxOdin },
        assignedClientId: selectedClient
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(isDiscrepancy ? 'Objection Raised!' : 'Approved!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error submitting');
    }
  };

  if (!skuData) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Location: {location}</h1>
        <label>Enter SKU ID:</label>
        <input className="w-full border p-2 mb-2" value={skuId} onChange={e => setSkuId(e.target.value)} />
        <button onClick={fetchSku} className="bg-blue-600 text-white w-full py-2 rounded">Search</button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold text-lg">{skuData.name}</h2>
        <p>Picking Loc: {skuData.pickingLocation} | Bulk Loc: {skuData.bulkLocation}</p>
        <p>System Qty: {skuData.systemQuantity}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {Object.keys(counts).map(k => (
          <div key={k}>
            <label className="capitalize text-sm">{k}</label>
            <input type="number" className="w-full border p-1" 
              value={counts[k]} onChange={e => setCounts({...counts, [k]: e.target.value})} />
          </div>
        ))}
      </div>
      <div className="text-right font-bold mb-4">Total Identified: {total}</div>

      <div className="bg-yellow-50 p-4 rounded mb-4">
        <h3 className="font-bold">ODIN Data</h3>
        <label className="block mt-2">Min Quantity</label>
        <input type="number" className="w-full border p-1" value={odin.min} onChange={e => setOdin({...odin, min: e.target.value})} />
        <label className="block mt-2">Blocked Quantity</label>
        <input type="number" className="w-full border p-1" value={odin.blocked} onChange={e => setOdin({...odin, blocked: e.target.value})} />
        <p className="mt-2 font-bold">Max Quantity: {maxOdin}</p>
      </div>

      {isDiscrepancy && (
        <div className="bg-red-50 p-4 border border-red-200 mb-4">
          <p className="text-red-700 font-bold">Audit Query: {isExcess ? 'EXCESS' : 'SHORTFALL'}</p>
          <label className="block mt-2">Raise objection to Client:</label>
          <select className="w-full border p-2" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
            <option value="">Select Client Staff</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <button onClick={handleSubmit} disabled={isDiscrepancy && !selectedClient} 
        className="w-full bg-green-600 text-white py-3 rounded disabled:bg-gray-400">
        Submit Audit
      </button>
    </div>
  );
}

export default withAuth(StaffDashboard, 'staff');
