import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    uniqueCode: '',
    loginPin: ''
  });
  
  const [role, setRole] = useState('staff'); // Default to Staff login
  const router = useRouter();
  const { email, password, uniqueCode, loginPin } = formData;

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = role === 'admin' 
        ? { email, password, role } 
        : { uniqueCode, loginPin, role };

      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/login`, payload);
      
      localStorage.setItem('token', res.data.token);
      
      // Redirect based on role
      if (res.data.user.role === 'admin') router.push('/admin');
      else if (res.data.user.role === 'client') router.push('/client');
      else router.push('/staff/select-location'); // Goto Location Select

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <div className="mt-4 flex justify-center space-x-4">
          <button 
            onClick={() => setRole('staff')} 
            className={`px-4 py-2 rounded ${role === 'staff' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Staff / Client
          </button>
          <button 
            onClick={() => setRole('admin')} 
            className={`px-4 py-2 rounded ${role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Admin
          </button>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={onSubmit}>
            
            {role === 'admin' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email address</label>
                  <input type="email" name="email" value={email} onChange={onChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" name="password" value={password} onChange={onChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Staff ID / Client Code</label>
                  <input type="text" name="uniqueCode" value={uniqueCode} onChange={onChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" placeholder="e.g. 26A" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Login PIN</label>
                  <input type="password" name="loginPin" value={loginPin} onChange={onChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" placeholder="e.g. 5013" />
                </div>
              </>
            )}

            <div>
              <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
