// Inventory index 
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (req.method === 'POST') {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory`,
        req.body,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      res.status(201).json(response.data);
    } else if (req.method === 'GET') {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: req.query
        }
      );
      res.status(200).json(response.data);
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    res.status(400).json({ message: error.response?.data?.message || 'Error processing request' });
  }
}