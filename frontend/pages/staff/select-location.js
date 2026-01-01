import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function SelectLocation() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // 1. Get User Data
    const token = localStorage.getItem('token');
    if (!token) {
        router.push('/login');
        return;
    }

    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
        setUser(res.data);
        
        // 2. Parse Locations
        // Handle both Array format AND legacy comma-separated string
        let locs = [];
        if (Array.isArray(res.data.locations) && res.data.locations.length > 0) {
            locs = res.data.locations;
        } else if (res.data.mappedLocation) {
            locs = res.data.mappedLocation.split(',').map(l => l.trim());
        }
        
        // If only 1 location, auto-select and redirect
        if (locs.length === 1) {
            localStorage.setItem('activeLocation', locs[0]);
            router.push('/staff');
        } else {
            setLocations(locs);
        }
    })
    .catch(() => router.push('/login'));
  }, []);

  const handleContinue = () => {
    if (!selectedLocation) return alert('Please select a location');
    
    // Save selection to LocalStorage for the session
    localStorage.setItem('activeLocation', selectedLocation);
    router.push('/staff');
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Select Your Location
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hello, {user.name}. Where are you working today?
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Assigned Locations
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
              >
                <option value="">-- Choose a Location --</option>
                {locations.map((loc, idx) => (
                  <option key={idx} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={handleContinue}
                disabled={!selectedLocation}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
