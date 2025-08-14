const nodemailer = require('nodemailer');
const twilio = require('twilio');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = {
  notifyClients: async (entry) => {
    try {
      // Get all client users
      const clients = await User.find({ role: 'client' });
      
      for (const clientUser of clients) {
        // Send email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: clientUser.email,
          subject: 'New Inventory Entry Requires Review',
          html: `
            <p>A new inventory entry requires your review:</p>
            <ul>
              <li>Bin ID: ${entry.binId}</li>
              <li>Book Quantity: ${entry.bookQuantity}</li>
              <li>Actual Quantity: ${entry.actualQuantity}</li>
              <li>Discrepancy: ${entry.discrepancy}</li>
            </ul>
            <p>Please log in to the portal to review this entry.</p>
          `
        });
        
        // Send WhatsApp if phone number is available
        if (clientUser.phone) {
          await client.messages.create({
            body: `New inventory entry requires review. Bin ID: ${entry.binId}, Discrepancy: ${entry.discrepancy}`,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${clientUser.phone}`
          });
        }
      }
    } catch (error) {
      console.error('Error sending client notifications:', error);
    }
  },
  
  notifyClient: async (client, entry) => {
    try {
      // Send email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: client.email,
        subject: 'New Inventory Entry Requires Review',
        html: `
          <p>A new inventory entry requires your review:</p>
          <ul>
            <li>Bin ID: ${entry.binId}</li>
            <li>Book Quantity: ${entry.bookQuantity}</li>
            <li>Actual Quantity: ${entry.actualQuantity}</li>
            <li>Discrepancy: ${entry.discrepancy}</li>
          </ul>
          <p>Please log in to the portal to review this entry.</p>
        `
      });
      
      // Send WhatsApp if phone number is available
      if (client.phone) {
        await client.messages.create({
          body: `New inventory entry requires review. Bin ID: ${entry.binId}, Discrepancy: ${entry.discrepancy}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${client.phone}`
        });
      }
    } catch (error) {
      console.error('Error sending client notification:', error);
    }
  },
  
  notifyStaff: async (entry, message) => {
    try {
      const staff = await User.findById(entry.staffId);
      
      // Send email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: staff.email,
        subject: 'Inventory Entry Update',
        html: `
          <p>${message}</p>
          <p>Bin ID: ${entry.binId}</p>
          <p>Please log in to the portal for more details.</p>
        `
      });
      
      // Send WhatsApp if phone number is available
      if (staff.phone) {
        await client.messages.create({
          body: `${message} Bin ID: ${entry.binId}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${staff.phone}`
        });
      }
    } catch (error) {
      console.error('Error sending staff notification:', error);
    }
  }
};
