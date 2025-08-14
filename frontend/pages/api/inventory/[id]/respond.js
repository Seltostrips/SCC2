// Respond endpoint 
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const { action, comment } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/${id}/respond`,
      { action, comment },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.response?.data?.message || 'Error responding to entry' });
  }
}
