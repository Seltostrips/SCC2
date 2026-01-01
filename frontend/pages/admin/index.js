import { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('monitor'); 
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Upload State
  const [uploadType, setUploadType] = useState('inventory');
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', loginPin: '', locationsStr: '' });

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
        const res = await axios.get(`${baseUrl}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // -- EDIT USER LOGIC --
  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({
        name: user.name,
        loginPin: user.loginPin || '', // Only usually visible for new saves, but if you want to overwrite
        locationsStr: user.locations ? user.locations.join(', ') : ''
    });
  };

  const handleEditSave = async () => {
      try {
          const token = localStorage.getItem('token');
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
          
          // Parse locations string back to array
          const locArray = editForm.locationsStr.split(',').map(s => s.trim()).filter(s => s);

          await axios.put(`${baseUrl}/api/auth/users/${editingUser._id}`, {
              name: editForm.name,
              loginPin: editForm.loginPin,
              locations: locArray
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });

          setEditingUser(null);
          fetchData(); // Refresh list
          alert('User updated successfully');
      } catch (err) {
          console.error(err);
          alert('Failed to update user');
      }
  };

  // -- TEMPLATE DOWNLOAD --
  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = '';

    if (uploadType === 'inventory') {
      headers = ['SKU ID', 'Name of the SKU ID', 'Picking Location', 'Bulk Location', 'Quantity as on the date of Sampling'];
      filename = 'inventory_template.csv';
    } else if (uploadType === 'staff' || uploadType === 'client') {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location1', 'Location2', 'Location3', 'Location4', 'Location5', 'Location6'];
      filename = `${uploadType}_template.csv`;
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

  // -- FILE UPLOAD --
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
        let updateCount = 0;
        let failCount = 0;

        // INVENTORY UPLOAD
        if (uploadType === 'inventory') {
            // ... (Inventory logic remains same)
             const firstRow = results.data[0];
             if (!firstRow['SKU ID']) { setLoading(false); return alert('Missing "SKU ID" column'); }
             for (const row of results.data) {
                try {
                    await axios.post(`${baseUrl}/api/admin/upload-inventory`, {
                        skuId: row['SKU ID'],
                        name: row['Name of the SKU ID'],
                        pickingLocation: row['Picking Location'],
                        bulkLocation: row['Bulk Location'],
                        systemQuantity: parseFloat(row['Quantity as on the date of Sampling']) || 0
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    successCount++;
                } catch (err) { failCount++; }
             }
        } 
        
        // STAFF / CLIENT UPLOAD
        else {
           const firstRow = results.data[0];
           // Allow either "Staff ID" or "Client ID" column header
           if (!firstRow['Staff ID'] && !firstRow['Client ID']) {
              setLoading(false);
              return alert('Error: CSV must have "Staff ID" column.');
           }

           for (const row of results.data) {
             try {
               const locArray = [];
               for (let i = 1; i <= 6; i++) {
                 if (row[`Location${i}`] && row[`Location${i}`].trim()) {
                   locArray.push(row[`Location${i}`].trim());
                 }
               }

               const res = await axios.post(`${baseUrl}/api/auth/register`, {
                 name: row['Name'],
                 uniqueCode: row['Staff ID'] || row['Client ID'],
                 loginPin: row['Login PIN'],
                 role: uploadType,
                 locations: locArray,
                 mappedLocation: locArray.join(', ')
               }, { headers: { Authorization: `Bearer ${token}` } });
               
               if (res.data.type === 'update') updateCount++;
               else successCount++;

             } catch (err) {
               console.error(`Failed ${row['Name']}`, err);
               failCount++;
             }
           }
        }

        setLoading(false);
        setUploadStatus(`Done! Created: ${successCount}, Updated: ${updateCount}, Failed: ${failCount}`);
        e.target.value = null;
        if (activeTab === 'users') fetchData(); // Refresh table if on users tab
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* NAVIGATION */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-indigo-600">
                Admin Panel
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button onClick={() => setActiveTab('monitor')} className={`${activeTab === 'monitor' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                  Monitor Inventory
                </button>
                <button onClick={() => setActiveTab('users')} className={`${activeTab === 'users' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                  Manage Users
                </button>
                <button onClick={() => setActiveTab('upload')} className={`${activeTab === 'upload' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
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
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'auto-approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
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
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => handleEditClick(u)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
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
                      className="mt-1 block w-full"
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

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setEditingUser(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Edit User: {editingUser.name}</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Name</label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="mt-1 block w-full border rounded p-2"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Login PIN</label>
                            <input type="text" value={editForm.loginPin} onChange={e => setEditForm({...editForm, loginPin: e.target.value})} className="mt-1 block w-full border rounded p-2" placeholder="Enter new PIN to override"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Locations (comma separated)</label>
                            <input type="text" value={editForm.locationsStr} onChange={e => setEditForm({...editForm, locationsStr: e.target.value})} className="mt-1 block w-full border rounded p-2"/>
                            <p className="text-xs text-gray-500 mt-1">e.g. Noida WH, Delhi Hub</p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleEditSave} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
