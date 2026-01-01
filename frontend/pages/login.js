import { useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Login() {
  const [formData, setFormData] = useState({ sccId: '', pin: '', email: '', password: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', formData);
      localStorage.setItem('token', res.data.token);
      const user = res.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));

      if (user.role === 'staff') router.push('/staff/select-location');
      else if (user.role === 'client') router.push('/client');
      else router.push('/admin');
    } catch (err) {
      alert(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded shadow w-96">
        <h2 className="text-2xl mb-4 font-bold">SCC Portal Login</h2>
        
        <div className="mb-4 flex justify-between">
          <button type="button" onClick={() => setIsAdmin(false)} className={`text-sm ${!isAdmin ? 'font-bold underline' : ''}`}>Staff/Client</button>
          <button type="button" onClick={() => setIsAdmin(true)} className={`text-sm ${isAdmin ? 'font-bold underline' : ''}`}>Admin</button>
        </div>

        {!isAdmin ? (
          <>
            <input className="w-full mb-3 p-2 border" placeholder="Enter SCC ID (e.g., 26A)" 
              onChange={e => setFormData({...formData, sccId: e.target.value})} />
            <input className="w-full mb-3 p-2 border" type="password" placeholder="Enter PIN" 
              onChange={e => setFormData({...formData, pin: e.target.value})} />
          </>
        ) : (
          <>
            <input className="w-full mb-3 p-2 border" placeholder="Email" 
              onChange={e => setFormData({...formData, email: e.target.value})} />
            <input className="w-full mb-3 p-2 border" type="password" placeholder="Password" 
              onChange={e => setFormData({...formData, password: e.target.value})} />
          </>
        )}
        
        <button className="w-full bg-blue-600 text-white py-2 rounded">Login</button>
      </form>
    </div>
  );
}
