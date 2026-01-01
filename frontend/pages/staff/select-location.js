import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import withAuth from '../../components/withAuth';

function SelectLocation() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user')));
  }, []);

  const handleSelect = (loc) => {
    localStorage.setItem('activeLocation', loc);
    router.push('/staff');
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-xl font-bold mb-6">Select Active Location</h1>
      <div className="grid gap-4">
        {user.assignedLocations?.map((loc, index) => (
          <button key={index} onClick={() => handleSelect(loc)}
            className="px-6 py-3 bg-white border rounded shadow hover:bg-blue-50 font-medium">
            {loc}
          </button>
        ))}
      </div>
    </div>
  );
}

export default withAuth(SelectLocation, 'staff');
