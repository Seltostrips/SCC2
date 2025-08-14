// Login endpoint 
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { email, password } = req.body;
    
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
      email,
      password
    });
    
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.response?.data?.message || 'Login failed' });
  }
}
