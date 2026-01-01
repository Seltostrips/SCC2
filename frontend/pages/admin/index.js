import { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor', 'users', 'upload'
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Upload State
  const [uploadType, setUploadType] = useState('inventory'); // 'inventory', 'staff', 'client'
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // -- DATA FETCHING --
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    
    try {
      if (activeTab === 'monitor') {
        const res = await axios.get(`${baseUrl}/api/admin/inventory-all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInventory(res.data);
      } else if (activeTab === 'users') {
        // We use the auth route to fetch users
        const res = await axios.get(`${baseUrl}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // -- TEMPLATE DOWNLOAD LOGIC (Legacy Headers Preserved) --
  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = '';

    if (uploadType === 'inventory') {
      headers = ['SKU ID', 'Name of the SKU ID', 'Picking Location', 'Bulk Location', 'Quantity as on the date of Sampling'];
      filename = 'inventory_template.csv';
    } else if (uploadType === 'staff') {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location1', 'Location2', 'Location3', 'Location4', 'Location5', 'Location6'];
      filename = 'staff_template.csv';
    } else if (uploadType === 'client') {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location1', 'Location2', 'Location3', 'Location4', 'Location5', 'Location6'];
      filename = 'client_template.csv';
    }

    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -- FILE UPLOAD LOGIC --
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setUploadStatus('Parsing CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.data.length === 0) {
          setLoading(false);
          return alert('File empty');
        }

        const token = localStorage.getItem('token');
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        let successCount = 0;
        let failCount = 0;

        // --- SCENARIO A: REFERENCE INVENTORY UPLOAD ---
        if (uploadType === 'inventory') {
          const firstRow = results.data[0];
          if (!firstRow['SKU ID']) {
             setLoading(false);
             return alert('Error: CSV must have "SKU ID" column.');
          }

          for (const row of results.data) {
             try {
                const payload = {
                   skuId: row['SKU ID'],
                   name: row['Name of the SKU ID'],
                   pickingLocation: row['Picking Location'],
                   bulkLocation: row['Bulk Location'],
                   systemQuantity: parseFloat(row['Quantity as on the date of Sampling']) || 0
                };

                await axios.post(`${baseUrl}/api/admin/upload-inventory`, payload, {
                   headers: { Authorization: `Bearer ${token}` }
                });
                successCount++;
             } catch (err) {
                console.error('Failed row:', row);
                failCount++;
             }
          }
        } 
        
        // --- SCENARIO B: STAFF / CLIENT UPLOAD (Multi-Location Logic) ---
        else {
           const firstRow = results.data[0];
           if (!firstRow['Staff ID'] && !firstRow['Client ID']) {
              setLoading(false);
              return alert('Error: CSV must have "Staff ID" column.');
           }

           for (const row of results.data) {
             try {
               // Logic to consolidate Location1...Location6 into an array
               const locArray = [];
               for (let i = 1; i <= 6; i++) {
                 if (row[`Location${i}`] && row[`Location${i}`].trim()) {
                   locArray.push(row[`Location${i}`].trim());
                 }
               }

               const payload = {
                 name: row['Name'],
                 uniqueCode: row['Staff ID'] || row['Client ID'],
                 loginPin: row['Login PIN'],
                 role: uploadType, // 'staff' or 'client'
                 locations: locArray, // <-- ARRAY SAVED HERE
                 mappedLocation: locArray.join(', ') // Legacy string support
               };

               await axios.post(`${baseUrl}/api/auth/register`, payload, {
                  headers: { Authorization: `Bearer ${token}` }
               });
               successCount++;
             } catch (err) {
               console.error(`Failed to upload ${row['Name']}:`, err);
               failCount++;
             }
           }
        }

        setLoading(false);
        setUploadStatus(`Upload Complete. Success: ${successCount}, Failed: ${failCount}`);
        e.target.value = null;
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* NAVIGATION */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-indigo-600">
                Admin Panel
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('monitor')}
                  className={`${activeTab === 'monitor' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Monitor Inventory
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`${activeTab === 'users' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Manage Users
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`${activeTab === 'upload' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Data Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          
          {/* TAB 1: MONITOR */}
          {activeTab === 'monitor' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Live Inventory Submissions</h3>
                <button onClick={fetchData} className="text-indigo-600 hover:text-indigo-900 text-sm">Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventory.map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.skuId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${item.status === 'auto-approved' ? 'bg-green-100 text-green-800' : 
                              item.status === 'client-rejected' ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.staffId?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.auditResult}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">System Users</h3>
              </div>
              <div className="border-t border-gray-200">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code/ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Locations</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(u => (
                        <tr key={u._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{u.role}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{u.uniqueCode}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                             {u.locations && u.locations.length > 0 
                               ? u.locations.map(l => <span key={l} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs mr-1 mb-1">{l}</span>) 
                               : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}

          {/* TAB 3: UPLOAD */}
          {activeTab === 'upload' && (
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Bulk Data Upload</h3>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Type</label>
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 sm:text-sm rounded-md border"
                    >
                      <option value="inventory">Reference Inventory (ODIN)</option>
                      <option value="staff">Staff Accounts</option>
                      <option value="client">Client Accounts</option>
                    </select>
                  </div>

                  <div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Download CSV Template
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Upload CSV File</label>
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={loading}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  {loading && <p className="text-blue-600 font-bold animate-pulse">{uploadStatus}</p>}
                  {!loading && uploadStatus && (
                    <div className={`p-4 rounded-md ${uploadStatus.includes('Failed') ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                      {uploadStatus}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
