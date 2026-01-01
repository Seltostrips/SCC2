import { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor', 'users', 'upload'
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [uploadType, setUploadType] = useState('inventory');
  
  // -- DATA FETCHING --
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      if (activeTab === 'monitor') {
        const res = await axios.get(`${baseUrl}/api/admin/inventory-all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInventory(res.data);
      } else if (activeTab === 'users') {
        const res = await axios.get(`${baseUrl}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // -- UPLOAD LOGIC (From previous step) --
  const handleDownloadTemplate = () => {
    // ... (Keep existing download logic or copy from previous turn if needed)
    let headers = [];
    let filename = '';
    if (uploadType === 'inventory') {
      headers = ['SKU ID', 'Name of the SKU ID', 'Picking Location', 'Bulk Location', 'Quantity as on the date of Sampling'];
      filename = 'inventory_template.csv';
    } else if (uploadType === 'staff') {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location1', 'Location2', 'Location3', 'Location4', 'Location5', 'Location6'];
      filename = 'staff_template.csv';
    } else if (uploadType === 'client') {
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location'];
      filename = 'client_template.csv';
    }
    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.click();
    link.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.data.length === 0) return alert('File empty');
        
        // Basic Validation
        const firstRow = results.data[0];
        if (uploadType === 'inventory' && !firstRow['SKU ID']) {
            return alert(`Error: Missing "SKU ID" column. Found: ${Object.keys(firstRow).join(', ')}`);
        }
        processUpload(results.data);
      }
    });
  };

  const processUpload = async (data) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      let endpoint = '';
      let payload = [];

      if (uploadType === 'inventory') {
        endpoint = `${baseUrl}/api/admin/upload-inventory`;
        payload = data.map(row => ({
          skuId: row['SKU ID'],
          name: row['Name of the SKU ID'],
          pickingLocation: row['Picking Location'],
          bulkLocation: row['Bulk Location'],
          systemQuantity: Number(row['Quantity as on the date of Sampling'] || 0)
        }));
      } else if (uploadType === 'staff') {
        endpoint = `${baseUrl}/api/admin/assign-staff`;
        payload = data.map(row => ({
          sccId: row['Staff ID'],
          pin: row['Login PIN'],
          name: row['Name'],
          assignedLocations: [row['Location1'], row['Location2'], row['Location3'], row['Location4'], row['Location5'], row['Location6']].filter(Boolean)
        }));
      } else if (uploadType === 'client') {
        endpoint = `${baseUrl}/api/admin/assign-client`;
        payload = data.map(row => ({
          sccId: row['Staff ID'],
          pin: row['Login PIN'],
          name: row['Name'],
          mappedLocation: row['Location']
        }));
      }

      await axios.post(endpoint, payload, { headers: { Authorization: `Bearer ${token}` } });
      alert('Upload Successful!');
      fetchData(); // Refresh data
    } catch (err) {
      alert('Upload Failed');
    }
  };

  // -- RENDER HELPERS --
  const getStatusColor = (status) => {
    if (status === 'auto-approved' || status === 'client-approved') return 'bg-green-100 text-green-800';
    if (status === 'client-rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Admin Control Panel</h1>

        {/* TABS */}
        <div className="flex mb-6 border-b bg-white rounded-t-lg shadow-sm">
          {['monitor', 'users', 'upload'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-medium capitalize focus:outline-none ${
                activeTab === tab 
                  ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'monitor' ? 'Audit Monitor' : tab === 'users' ? 'User Management' : 'Data Upload'}
            </button>
          ))}
        </div>

        {/* TAB 1: AUDIT MONITOR */}
        {activeTab === 'monitor' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU / Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventory.map((item) => (
                  <tr key={item._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.timestamps.entry).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.skuId} <br/> <span className="text-gray-500 font-normal">{item.skuName}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.location}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.staffId?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm">
                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                         ${item.auditResult === 'Match' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                         {item.auditResult}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                         {item.status}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Registered Users</h3>
              <button 
                onClick={() => setActiveTab('upload')} 
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm"
              >
                Assign / Reassign via Upload
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SCC ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignments</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="px-6 py-4 text-sm font-medium">{u.sccId || u.email}</td>
                    <td className="px-6 py-4 text-sm">{u.name}</td>
                    <td className="px-6 py-4 text-sm capitalize">{u.role}</td>
                    <td className="px-6 py-4 text-sm font-mono">****</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {u.role === 'staff' 
                        ? u.assignedLocations?.join(', ') 
                        : u.mappedLocation || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: DATA UPLOAD (Previous Logic) */}
        {activeTab === 'upload' && (
          <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-4">
                {['inventory', 'staff', 'client'].map(type => (
                   <label key={type} className="flex items-center space-x-2 cursor-pointer">
                     <input 
                       type="radio" 
                       checked={uploadType === type} 
                       onChange={() => setUploadType(type)}
                       className="form-radio text-indigo-600"
                     />
                     <span className="capitalize">{type} DB</span>
                   </label>
                ))}
              </div>
              <button onClick={handleDownloadTemplate} className="text-indigo-600 text-sm font-bold hover:underline">
                Download {uploadType} Template
              </button>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload} 
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-4">Upload {uploadType} CSV to assign/update records</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
