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

  // -- API HELPER (Preserved Feature: Safe URL handling) --
  const getApiUrl = (endpoint) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  };

  // -- DATA FETCHING --
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
        setInventory(res.data);
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

  // -- NEW FEATURE: DOWNLOAD AUDIT REPORT --
  const handleDownloadReport = () => {
    if (inventory.length === 0) return alert('No data to download');

    // Maps columns exactly as requested
    const csvData = inventory.map(item => ({
        'SKU ID': item.skuId,
        'Name': item.skuName,
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

  // -- EDIT USER LOGIC (Preserved) --
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
          // Split string back into array (Preserved Logic)
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

  // -- TEMPLATE DOWNLOAD (Preserved Headers) --
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

  // -- FILE UPLOAD (Preserved 6-Location Parsing) --
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
        let success=0, fail=0, updateCount=0;
        
        if (uploadType === 'inventory') {
             for (const row of results.data) {
                if(!row['SKU ID']) continue;
                try {
                    await axios.post(getApiUrl('/api/admin/upload-inventory'), {
                        skuId: row['SKU ID'],
                        name: row['Name of the SKU ID'],
                        pickingLocation: row['Picking Location'],
                        bulkLocation: row['Bulk Location'],
                        systemQuantity: parseFloat(row['Quantity as on the date of Sampling']) || 0
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    success++;
                } catch (e) { fail++; }
             }
        } else {
           for (const row of results.data) {
             if(!row['Staff ID'] && !row['Client ID']) continue;
             try {
               // Location1..Location6 parsing preserved here
               const locArray = [];
               for (let i = 1; i <= 6; i++) {
                 if (row[`Location${i}`]?.trim()) locArray.push(row[`Location${i}`].trim());
               }
               
               const res = await axios.post(getApiUrl('/api/auth/register'), {
                 name: row['Name'],
                 uniqueCode: row['Staff ID'] || row['Client ID'],
                 loginPin: row['Login PIN'],
                 role: uploadType,
                 locations: locArray,
                 mappedLocation: locArray.join(', ')
               }, { headers: { Authorization: `Bearer ${token}` } });
               
               if(res.data.type === 'update') updateCount++;
               else success++;
             } catch (e) { fail++; }
           }
        }
        setLoading(false);
        setUploadStatus(`Done! Created: ${success}, Updated: ${updateCount}, Failed: ${fail}`);
        e.target.value = null;
        if (activeTab === 'users') fetchData();
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
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium capitalize`}>
                      {tab}
                    </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          
          {/* TAB 1: MONITOR + REPORT BUTTON */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discrepancy</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventory.map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.skuId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'auto-approved' ? 'bg-green-100 text-green-800' : item.status === 'client-rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.staffName}</td>
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

          {/* TAB 2: USERS + EDIT BUTTON */}
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                             {u.locations && u.locations.length > 0 
                               ? u.locations.map(l => <span key={l} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs mr-1 mb-1">{l}</span>) 
                               : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium"><button onClick={() => handleEditClick(u)} className="text-indigo-600 hover:text-indigo-900">Edit</button></td>
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

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setEditingUser(null)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Edit User: {editingUser.name}</h3>
                <div className="mt-4 space-y-4">
                    <div>
                       <label className="block text-sm font-bold text-gray-700">Name</label>
                       <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border p-2 rounded"/>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700">Login PIN</label>
                       <input type="text" value={editForm.loginPin} onChange={e => setEditForm({...editForm, loginPin: e.target.value})} className="w-full border p-2 rounded" placeholder="New PIN"/>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700">Locations (comma separated)</label>
                       <input type="text" value={editForm.locationsStr} onChange={e => setEditForm({...editForm, locationsStr: e.target.value})} className="w-full border p-2 rounded"/>
                    </div>
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
