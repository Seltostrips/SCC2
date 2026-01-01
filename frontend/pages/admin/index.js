import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [uploadType, setUploadType] = useState('inventory'); // inventory, staff, client

  // 1. Logic to Download Templates
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
      headers = ['Staff ID', 'Login PIN', 'Name', 'Location'];
      filename = 'client_template.csv';
    }

    // Create CSV content (Comma separated)
    const csvContent = headers.join(',');
    
    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Logic to Handle Uploads (Smart Parser)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log("Parsed Data:", results.data); 
        
        if (results.data.length === 0) {
           alert('CSV Error: File appears empty.');
           return;
        }

        // Basic Validation
        const firstRow = results.data[0];
        if (uploadType === 'inventory' && !firstRow['SKU ID']) {
          alert(`CSV Error: Could not find "SKU ID".\nDetected Headers: ${Object.keys(firstRow).join(', ')}`);
          return;
        }

        const data = results.data;
        processData(data);
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        alert('Failed to parse CSV file.');
      }
    });
  };

  const processData = async (data) => {
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let payload = [];

      if (uploadType === 'inventory') {
        endpoint = '/api/admin/upload-inventory';
        payload = data.map(row => ({
          skuId: row['SKU ID'],
          name: row['Name of the SKU ID'],
          pickingLocation: row['Picking Location'],
          bulkLocation: row['Bulk Location'],
          systemQuantity: Number(row['Quantity as on the date of Sampling'] || 0)
        }));
      } else if (uploadType === 'staff') {
        endpoint = '/api/admin/assign-staff';
        payload = data.map(row => ({
          sccId: row['Staff ID'],
          pin: row['Login PIN'],
          name: row['Name'],
          assignedLocations: [
            row['Location1'], row['Location2'], row['Location3'], 
            row['Location4'], row['Location5'], row['Location6']
          ].filter(Boolean)
        }));
      } else if (uploadType === 'client') {
        endpoint = '/api/admin/assign-client';
        payload = data.map(row => ({
          sccId: row['Staff ID'],
          pin: row['Login PIN'],
          name: row['Name'],
          mappedLocation: row['Location']
        }));
      }

      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Upload Successful!');
      window.location.reload(); // Refresh to clear file input
    } catch (err) {
      console.error(err);
      alert('Upload Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Admin Upload Center</h1>
      
      {/* 3. Tab Selection */}
      <div className="flex mb-8 border-b">
        {['inventory', 'staff', 'client'].map((type) => (
          <button
            key={type}
            onClick={() => setUploadType(type)}
            className={`mr-6 pb-2 text-lg capitalize font-medium transition-colors ${
              uploadType === type 
                ? 'border-b-4 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {type} DB
          </button>
        ))}
      </div>

      {/* 4. Upload Area */}
      <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold capitalize text-gray-700">
            Upload {uploadType} Data
          </h2>
          
          {/* New Download Template Button */}
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors text-sm font-semibold"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download {uploadType} Template
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-4">
            Supports .csv files (Comma or Semicolon delimited)
          </p>
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
