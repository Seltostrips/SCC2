// Pending inventory 
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/pending`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.response?.data?.message || 'Error fetching pending entries' });
  }
}
