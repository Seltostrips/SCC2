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
        // Fetch All Inventory Submissions
        const res = await axios.get(`${baseUrl}/api/admin/inventory-all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInventory(res.data);
      } else if (activeTab === 'users') {
        // Fetch All Users
        const res = await axios.get(`${baseUrl}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // -- TEMPLATE DOWNLOAD LOGIC --
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
      // Client CSV structure usually matches Staff but role differs
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
          // Validate Headers
          const firstRow = results.data[0];
          if (!firstRow['SKU ID']) {
             setLoading(false);
             return alert('Error: CSV must have "SKU ID" column.');
          }

          // Process in Batches or One-by-One
          for (const row of results.data) {
             try {
                // Map CSV headers to Mongoose Schema
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
        
        // --- SCENARIO B: STAFF / CLIENT UPLOAD ---
        else {
           // Validate Headers
           const firstRow = results.data[0];
           if (!firstRow['Staff ID'] && !firstRow['Client ID']) {
              setLoading(false);
              return alert('Error: CSV must have "Staff ID" (or Client ID) column.');
           }

           for (const row of results.data) {
             try {
               // Extract Locations from Location1...Location6
               const locArray = [];
               for (let i = 1; i <= 6; i++) {
                 if (row[`Location${i}`] && row[`Location${i}`].trim()) {
                   locArray.push(row[`Location${i}`].trim());
                 }
               }

               // Map CSV to User Schema
               const payload = {
                 name: row['Name'],
                 uniqueCode: row['Staff ID'] || row['Client ID'],
                 loginPin: row['Login PIN'],
                 role: uploadType, // 'staff' or 'client'
                 locations: locArray,
                 mappedLocation: locArray.join(', ') // Legacy support
               };

               await axios.post(`${baseUrl}/api/auth/register`, payload, {
                  headers: { Authorization: `Bearer ${token}` }
               });
               successCount++;
             } catch (err) {
               console.error(`Failed to upload ${row['Name']}:`, err);
               failCount
