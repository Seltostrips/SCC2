import '../styles/globals.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

let socket;

function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const res = await axios.get('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          console.log("Auth successful:", res.data);
          // Handle both response structures: { user: ... } and direct user object
          const userData = res.data.user || res.data;
          setUser(userData);
          setAuthError(null);
          
          // Initialize socket connection
          if (typeof window !== 'undefined') {
            import('socket.io-client').then((ioModule) => {
              socket = ioModule.default(process.env.NEXT_PUBLIC_API_URL);
              
              // Join role-based room
              socket.emit('join-room', userData.role);
              
              // Listen for new pending entries (for clients)
              if (userData.role === 'client') {
                socket.on('new-pending-entry', (entry) => {
                  alert('New inventory entry requires your review!');
                });
              }
              
              // Listen for entry updates (for staff)
              if (userData.role === 'staff') {
                socket.on('entry-updated', (entry) => {
                  if (entry.status === 'recount-required' && entry.staffId === userData.id) {
                    alert('Recount required for one of your entries!');
                  }
                });
              }
            });
          }
        } catch (err) {
          console.error('Auth error:', err.response?.data);
          setAuthError(err.response?.data?.message || 'Authentication failed');
          localStorage.removeItem('token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [router.pathname]);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    if (socket) socket.disconnect();
    router.push('/login');
  };

  // Don't show navbar on login and register pages
  const showNavbar = user && router.pathname !== '/login' && router.pathname !== '/register';

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {showNavbar && (
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between">
            <div>Inventory Audit Control Portal</div>
            <div>
              <span className="mr-4">Welcome, {user.name} ({user.role})</span>
              <button onClick={logout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                Logout
              </button>
            </div>
          </div>
        </nav>
      )}
      
      {authError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Authentication Error: </strong>
          <span className="block sm:inline">{authError}</span>
        </div>
      )}
      
      <Component {...pageProps} user={user} setUser={setUser} />
    </div>
  );
}

export default MyApp;
