import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import withAuth from '../../components/withAuth';

function AdminDashboard() {
  const [uploadType, setUploadType] = useState('inventory'); // inventory, staff, client

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        processData(data);
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
        // Map CSV headers to Model fields
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
          ].filter(Boolean) // Remove empty locations
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
    } catch (err) {
      console.error(err);
      alert('Upload Failed');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Upload Center</h1>
      
      <div className="mb-4">
        <label className="mr-4"><input type="radio" name="type" checked={uploadType === 'inventory'} onChange={() => setUploadType('inventory')} /> Inventory DB</label>
        <label className="mr-4"><input type="radio" name="type" checked={uploadType === 'staff'} onChange={() => setUploadType('staff')} /> Staff Assignments</label>
        <label className="mr-4"><input type="radio" name="type" checked={uploadType === 'client'} onChange={() => setUploadType('client')} /> Client Assignments</label>
      </div>

      <div className="border p-6 rounded bg-gray-50">
        <h2 className="text-lg font-bold mb-2">Upload {uploadType.toUpperCase()} CSV</h2>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
        <p className="text-sm text-gray-500 mt-2">Ensure CSV headers match the required format.</p>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard, 'admin');
