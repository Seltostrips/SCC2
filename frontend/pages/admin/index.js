import { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse'; // Ensure you have this: npm install papaparse
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/users', { // You might need to create this route or use existing
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setUploadStatus('Parsing CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setUploadStatus(`Uploading ${results.data.length} users...`);
        let successCount = 0;
        let failCount = 0;

        const token = localStorage.getItem('token');

        for (const row of results.data) {
          try {
            // --- CSV MAPPING LOGIC ---
            // Extract Locations from Location1, Location2, etc.
            const locArray = [];
            for (let i = 1; i <= 6; i++) {
              if (row[`Location${i}`] && row[`Location${i}`].trim()) {
                locArray.push(row[`Location${i}`].trim());
              }
            }

            // Construct Payload matching User.js Schema
            const payload = {
              name: row['Name'],
              uniqueCode: row['Staff ID'] || row['Client ID'], // Handles both column names
              loginPin: row['Login PIN'],
              role: row['Role'] ? row['Role'].toLowerCase() : 'staff', // Default to staff if missing
              locations: locArray,
              mappedLocation: locArray.join(', ') // Legacy string support
            };
            
            // Send to Register Route
            await axios.post('/api/auth/register', payload, {
               headers: { Authorization: `Bearer ${token}` }
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to upload ${row['Name']}:`, err);
            failCount++;
          }
        }
        
        setLoading(false);
        setUploadStatus(`Complete! Success: ${successCount}, Failed: ${failCount}`);
        fetchUsers();
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        {/* CSV UPLOAD SECTION */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Bulk Upload Staff/Clients</h2>
          
          <div className="mb-4 bg-blue-50 p-4 rounded text-sm text-blue-800">
            <p className="font-bold">Required CSV Headers:</p>
            <p className="font-mono mt-1">Staff ID, Login PIN, Name, Role, Location1, Location2, Location3, Location4, Location5, Location6</p>
            <p className="mt-2 text-xs">* Role should be "staff" or "client". Locations are optional (leave blank if unused).</p>
          </div>

          <div className="flex items-center gap-4">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              disabled={loading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {loading && <span className="font-bold text-indigo-600">{uploadStatus}</span>}
          </div>
          {!loading && uploadStatus && <p className="mt-2 text-green-600 font-medium">{uploadStatus}</p>}
        </div>

        {/* USER LIST (Optional Preview) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">System Users</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Code (ID)</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Locations</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 font-mono">{u.uniqueCode}</td>
                    <td className="p-3 capitalize">{u.role}</td>
                    <td className="p-3">
                       {u.locations && u.locations.length > 0 
                         ? u.locations.map(l => <span key={l} className="inline-block bg-gray-200 px-2 py-1 rounded text-xs mr-1">{l}</span>) 
                         : <span className="text-gray-400">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
