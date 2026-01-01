import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function StaffDashboard({ user }) {
  // Form State
  const [formData, setFormData] = useState({
    binId: '',
    bookQuantity: '',
    actualQuantity: '',
    notes: '',
    location: '',
    uniqueCode: '',
    pincode: ''
  });
  const [uniqueCodes, setUniqueCodes] = useState([]);
  
  // UI State
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data State for Sections
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchUniqueCodes();
    fetchHistory();
  }, []);

  const fetchUniqueCodes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/inventory/unique-codes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUniqueCodes(res.data);
    } catch (err) {
      console.error('Error fetching codes:', err);
    }
  };

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

  const { binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode } = formData;

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onUniqueCodeChange = (e) => {
    const selectedCode = e.target.value;
    const selectedClient = uniqueCodes.find(client => client.uniqueCode === selectedCode);
    
    setFormData({
      ...formData,
      uniqueCode: selectedCode,
      pincode: selectedClient ? selectedClient.location.pincode : ''
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/inventory', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.status === 'auto-approved') {
        setMessage('Entry auto-approved!');
      } else {
        setMessage('Entry sent to client for review');
      }
      
      // Reset form & Refresh list
      setFormData({
        binId: '', bookQuantity: '', actualQuantity: '', notes: '',
        location: '', uniqueCode: '', pincode: ''
      });
      fetchHistory(); // <--- Refresh sections immediately
      
    } catch (err) {
      console.error('Error submitting:', err);
      setMessage(err.response?.data?.message || 'Error submitting entry');
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
        
        {/* SUBMISSION FORM */}
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6 text-center">Staff Inventory Entry</h2>
          <p className="text-center mb-6">Staff: {user.name}</p>
          
          {message && (
            <div className={`mb-4 p-3 rounded text-center ${message.includes('auto-approved') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {message}
            </div>
          )}
          
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-gray-700 font-medium mb-1">Rack/Bin ID</label>
              <input type="text" name="binId" value={binId} onChange={onChange} className="w-full px-3 py-2 border rounded" required />
            </div>
            
            <div className="col-span-1">
               <label className="block text-gray-700 font-medium mb-1">Client Code</label>
               <select name="uniqueCode" value={uniqueCode} onChange={onUniqueCodeChange} className="w-full px-3 py-2 border rounded" required>
                 <option value="">Select a client</option>
                 {uniqueCodes.map(c => (
                   <option key={c._id} value={c.uniqueCode}>{c.company} - {c.uniqueCode}</option>
                 ))}
               </select>
            </div>

            <div className="col-span-1">
              <label className="block text-gray-700 font-medium mb-1">Book Quantity</label>
              <input type="number" name="bookQuantity" value={bookQuantity} onChange={onChange} className="w-full px-3 py-2 border rounded" required />
            </div>

            <div className="col-span-1">
              <label className="block text-gray-700 font-medium mb-1">Actual Count</label>
              <input type="number" name="actualQuantity" value={actualQuantity} onChange={onChange} className="w-full px-3 py-2 border rounded" required />
            </div>

            <div className="col-span-1">
              <label className="block text-gray-700 font-medium mb-1">Pincode</label>
              <input type="text" name="pincode" value={pincode} readOnly className="w-full px-3 py-2 border rounded bg-gray-100" />
            </div>
            
            <div className="col-span-1">
              <label className="block text-gray-700 font-medium mb-1">Location</label>
              <input type="text" name="location" value={location} onChange={onChange} className="w-full px-3 py-2 border rounded" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-gray-700 font-medium mb-1">Notes</label>
              <textarea name="notes" value={notes} onChange={onChange} className="w-full px-3 py-2 border rounded" rows="2"></textarea>
            </div>
            
            <div className="col-span-1 md:col-span-2 mt-4">
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? 'Submitting...' : 'Submit Entry'}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 1: Pending Client Approval */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-400">
          <h3 className="text-xl font-bold mb-4 text-yellow-700">Pending Client Approval</h3>
          {pendingSection.length === 0 ? <p className="text-gray-500">No pending items.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-100"><th className="p-2 text-left">Bin</th><th className="p-2 text-left">Code</th><th className="p-2 text-left">Discrepancy</th><th className="p-2 text-left">Date</th></tr></thead>
                <tbody>
                  {pendingSection.map(item => (
                    <tr key={item._id} className="border-b">
                      <td className="p-2">{item.binId}</td>
                      <td className="p-2">{item.uniqueCode}</td>
                      <td className="p-2 text-red-600 font-bold">{item.discrepancy}</td>
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
               <thead><tr className="bg-gray-100"><th className="p-2 text-left">Bin</th><th className="p-2 text-left">Code</th><th className="p-2 text-left">Reason</th></tr></thead>
               <tbody>
                 {rejectedSection.map(item => (
                   <tr key={item._id} className="border-b bg-red-50">
                     <td className="p-2">{item.binId}</td>
                     <td className="p-2">{item.uniqueCode}</td>
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
              <thead><tr className="bg-gray-100"><th className="p-2 text-left">Bin</th><th className="p-2 text-left">Code</th><th className="p-2 text-left">Status</th></tr></thead>
              <tbody>
                {matchedSection.map(item => (
                  <tr key={item._id} className="border-b">
                    <td className="p-2">{item.binId}</td>
                    <td className="p-2">{item.uniqueCode}</td>
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
