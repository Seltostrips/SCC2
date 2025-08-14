import { useState, useEffect } from 'react';
import axios from 'axios';
import withAuth from '../../components/withAuth';

function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [entries, setEntries] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    location: '',
    staff: '',
    uniqueCode: '',
    pincode: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchEntries();
    } else if (activeTab === 'approvals') {
      fetchPendingApprovals();
    } else if (activeTab === 'logs') {
      fetchLoginLogs();
    }
  }, [activeTab]);

  const fetchEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.location) params.append('location', filters.location);
      if (filters.staff) params.append('staff', filters.staff);
      if (filters.uniqueCode) params.append('uniqueCode', filters.uniqueCode);
      if (filters.pincode) params.append('pincode', filters.pincode);
      
      const res = await axios.get(`/api/inventory?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Entries:', res.data);
      setEntries(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching entries:', err);
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/pending-approvals', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPendingApprovals(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      setLoading(false);
    }
  };

  const fetchLoginLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/login-logs', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setLoginLogs(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching login logs:', err);
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const applyFilters = () => {
    setLoading(true);
    fetchEntries();
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      location: '',
      staff: '',
      uniqueCode: '',
      pincode: ''
    });
    setLoading(true);
    setTimeout(() => {
      fetchEntries();
    }, 100);
  };

  const handleApproveUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/auth/approve/${userId}`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh the list
      fetchPendingApprovals();
      alert('User approved successfully');
    } catch (err) {
      console.error('Error approving user:', err);
      alert('Error approving user');
    }
  };

  const handleExportLogs = () => {
    const csvData = loginLogs.map(log => ({
      Name: log.name,
      Email: log.email,
      Role: log.role,
      'Last Login': log.lastLogin?.timestamp ? new Date(log.lastLogin.timestamp).toLocaleString() : 'Never',
      'Location': log.lastLogin?.location ? 
        `${log.lastLogin.location.coordinates[1]}, ${log.lastLogin.location.coordinates[0]}` : 
        'N/A',
      'Registration Date': new Date(log.createdAt).toLocaleString()
    }));
    
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'user_login_logs.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <p className="text-center mb-6">Welcome, {user.name}</p>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'approvals'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Approvals
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Logs
            </button>
          </nav>
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={filters.location}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter location"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name</label>
                  <input
                    type="text"
                    name="staff"
                    value={filters.staff}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter staff name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unique Code</label>
                  <input
                    type="text"
                    name="uniqueCode"
                    value={filters.uniqueCode}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter unique code"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={filters.pincode}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter pincode"
                  />
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={applyFilters}
                  className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Apply Filters
                </button>
                
                <button
                  onClick={resetFilters}
                  className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Reset Filters
                </button>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-500">Total Bins Processed</p>
                  <p className="text-2xl font-bold">{entries.length}</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-500">Pending</p>
                  <p className="text-2xl font-bold">{entries.filter(e => e.status === 'pending-client').length}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-500">Resolved</p>
                  <p className="text-2xl font-bold">{entries.filter(e => e.status !== 'pending-client').length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {entries.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bin ID</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Qty</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Qty</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Code</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time to Approve</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entries.map((entry) => (
                        <tr key={entry._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.binId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.bookQuantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.actualQuantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.staffId?.name || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.clientId?.name || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.uniqueCode}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.status}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.timestamps.clientResponse && entry.timestamps.staffEntry
                              ? `${Math.round((entry.timestamps.clientResponse - entry.timestamps.staffEntry) / 60000)} mins`
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Pending Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {pendingApprovals.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No pending approvals</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Code</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingApprovals.map((user) => (
                      <tr key={user._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.company || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.uniqueCode || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.location ? `${user.location.city}, ${user.location.pincode}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleApproveUser(user._id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* User Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">User Login Logs</h2>
              <button
                onClick={handleExportLogs}
                className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Export to Excel
              </button>
            </div>
            {loginLogs.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No login logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loginLogs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.lastLogin?.timestamp ? new Date(log.lastLogin.timestamp).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.lastLogin?.location ? 
                            `${log.lastLogin.location.coordinates[1]}, ${log.lastLogin.location.coordinates[0]}` : 
                            'N/A'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
