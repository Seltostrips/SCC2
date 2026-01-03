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

  const getApiUrl = (endpoint) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      if (activeTab === 'monitor') {
        const res = await axios.get(getApiUrl('/api/admin/inventory-all'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // [CHANGE 1] PROCESS DATA FOR ATTEMPTS & AUDIT TRAIL
        // 1. Sort by Date Ascending first to order history correctly
        const sortedData = res.data.sort((a, b) => new Date(a.dateSubmitted) - new Date(b.dateSubmitted));
        
        // 2. Group by SKU to determine attempt numbers
        const groups = {};
        sortedData.forEach(item => {
            if (!groups[item.skuId]) groups[item.skuId] = [];
            groups[item.skuId].push(item);
        });

        // 3. Assign "Attempt" label (1, 2... Final)
        const processedData = [];
        Object.values(groups).forEach(group => {
            group.forEach((item, index) => {
                const isLast = index === group.length - 1;
                // Add new property 'attemptLabel'
                item.attemptLabel = isLast ? 'Final' : (index + 1).toString();
                processedData.push(item);
            });
        });

        // 4. Sort back to Descending (Newest first) for display
        processedData.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted));

        setInventory(processedData);

      } else if (activeTab === 'users') {
        const res = await axios.get(getApiUrl('/api/auth/users'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // -- DOWNLOAD REPORT (Includes All Attempts) --
  const handleDownloadReport = () => {
    if (inventory.length === 0) return alert('No data to download');

    const csvData = inventory.map(item => ({
        'SKU ID': item.skuId,
        'Name': item.skuName,
        'Attempt': item.attemptLabel, // [CHANGE 1] New Column
        'Picking Location': item.pickingLocation,
        'Bulk Location': item.bulkLocation,
        'Quantity as per Odin (Min)': item.odinMin,
        'Staff Name': item.staffName,
        'Status': item.status,
        'Client Name': item.clientName !== '-' ? item.clientName : '',
        'comments by client': item.clientComment !== '-' ? item.clientComment : '',
        'Audit Result': item.auditResult,
        'Physical Count': item.physicalCount,
        'Discrepancy': item.physicalCount - item.odinMax,
        'Date Submitted': new Date(item.dateSubmitted).toLocaleString()
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ... (Rest of the file remains unchanged: handleEditClick, handleEditSave, etc.)
  // [Preserving all existing logic below]

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({
        name: user.name,
        loginPin: user.loginPin || '', 
        locationsStr: user.locations ? user.locations.join(', ') : ''
    });
  };

  const handleEditSave = async () => {
      try {
          const token = localStorage.getItem('token');
          const locArray = editForm.locationsStr.split(',').map(s => s.trim()).filter(s => s);
          await axios.put(getApiUrl(`/api/auth/users/${editingUser._id}`), {
              name: editForm.name,
              loginPin: editForm.loginPin,
              locations: locArray
          }, { headers: { Authorization: `Bearer ${token}` } });
          setEditingUser(null);
          fetchData(); 
          alert('User updated successfully');
      } catch (err) { alert('Failed to update user'); }
  };

  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = '';
    if (uploadType === 'inventory') {
      headers = ['SKU ID', 'Name of the SKU ID', 'Picking Location', 'Bulk Location', 'Quantity as on the date of Sampling'];
      filename = 'inventory_template.csv';
    } else {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location1', 'Location2', 'Location3', 'Location4', 'Location5', 'Location6'];
      filename = `${uploadType}_template.csv`;
    }
    const blob = new Blob([headers.join(',')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setUploadStatus('Parsing...');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const token = localStorage.getItem('token');
        const rows = results.data;
        try {
            if (uploadType === 'inventory') {
                 const payload = rows.map(row => ({
                    skuId: row['skuId'] || row['SKU ID'],
                    name: row['name'] || row['Name of the SKU ID'],
                    pickingLocation: row['pickingLocation'] || row['Picking Location'],
                    bulkLocation: row['bulkLocation'] || row['Bulk Location'],
                    systemQuantity: parseFloat(row['systemQuantity'] || row['Quantity as on the date of Sampling'] || 0)
                 })).filter(i => i.skuId);
                 await axios.post(getApiUrl('/api/admin/upload-inventory'), payload, { headers: { Authorization: `Bearer ${token}` } });
                 setUploadStatus(`Success! Uploaded ${payload.length} items.`);
            } else {
               const payload = rows.map(row => {
                   const locArray = [];
                   for (let i = 1; i <= 6; i++) {
                     if (row[`Location${i}`]?.trim()) locArray.push(row[`Location${i}`].trim());
                   }
                   return {
                       uniqueCode: row['Staff ID'] || row['Client ID'],
                       loginPin: row['Login PIN'],
                       name: row['Name'],
                       locations: locArray,
                       mappedLocation: locArray.join(', ')
                   };
               }).filter(u => u.uniqueCode);
               const endpoint = uploadType === 'staff' ? '/api/admin/assign-staff' : '/api/admin/assign-client';
               await axios.post(getApiUrl(endpoint), payload, { headers: { Authorization: `Bearer ${token}` } });
               setUploadStatus(`Success! Updated ${payload.length} ${uploadType}s.`);
            }
            if (activeTab === 'users') fetchData();
        } catch (err) {
            console.error(err);
            setUploadStatus('Upload Failed.');
        } finally {
            setLoading(false);
            e.target.value = null;
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl text-indigo-600">Admin Panel</div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {['monitor', 'users', 'upload'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium capitalize`}>{tab}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {activeTab === 'monitor' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Live Inventory Submissions</h3>
                <div className="space-x-3">
                    <button onClick={handleDownloadReport} className="text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-bold shadow">
                       Download Report (CSV)
                    </button>
                    <button onClick={fetchData} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">Refresh</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      {/* [CHANGE 1] Added Attempt Column */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempt</th> 
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discrepancy</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* [CHANGE 1] Filter to show ONLY FINAL attempts in the UI */}
                    {inventory.filter(i => i.attemptLabel === 'Final').map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.skuId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'auto-approved' ? 'bg-green-100 text-green-800' : item.status === 'client-rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.staffName}</td>
                        {/* Show "Final" badge */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold bg-gray-50">
                            {item.attemptLabel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono font-bold">
                           {item.physicalCount - item.odinMax}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ... (Users Tab and Upload Tab logic kept exactly as before) ... */}
          {activeTab === 'users' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6"><h3 className="text-lg leading-6 font-medium text-gray-900">System Users</h3></div>
              <div className="border-t border-gray-200">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Locations</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(u => (
                        <tr key={u._id}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">{u.role}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">{u.uniqueCode}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.locations?.join(', ') || '-'}</td>
                          <td className="px-6 py-4 text-right text-sm font-medium"><button onClick={() => handleEditClick(u)} className="text-indigo-600 hover:text-indigo-900">Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Bulk Data Upload</h3>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Type</label>
                    <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 sm:text-sm rounded-md border">
                      <option value="inventory">Reference Inventory</option>
                      <option value="staff">Staff Accounts</option>
                      <option value="client">Client Accounts</option>
                    </select>
                  </div>
                  <div><button onClick={handleDownloadTemplate} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Download Template</button></div>
                  <div className="mt-4"><input type="file" accept=".csv" onChange={handleFileUpload} disabled={loading} className="mt-1 block w-full"/></div>
                  {loading && <p className="text-blue-600 font-bold animate-pulse">{uploadStatus}</p>}
                  {!loading && uploadStatus && <div className={`p-4 rounded-md ${uploadStatus.includes('Failed') ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>{uploadStatus}</div>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setEditingUser(null)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Edit User</h3>
                <div className="mt-4 space-y-4">
                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border p-2 rounded" placeholder="Name"/>
                    <input type="text" value={editForm.loginPin} onChange={e => setEditForm({...editForm, loginPin: e.target.value})} className="w-full border p-2 rounded" placeholder="New PIN"/>
                    <input type="text" value={editForm.locationsStr} onChange={e => setEditForm({...editForm, locationsStr: e.target.value})} className="w-full border p-2 rounded" placeholder="Locations (comma separated)"/>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button onClick={handleEditSave} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Save</button>
                <button onClick={() => setEditingUser(null)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
