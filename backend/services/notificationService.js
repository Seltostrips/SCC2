const nodemailer = require('nodemailer');
const twilio = require('twilio');
const User = require('../models/User');

// 1. Safe Initialization for Email
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  console.log("Email credentials missing. Email notifications disabled.");
}

// 2. Safe Initialization for Twilio (WhatsApp)
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.log("Twilio credentials missing. WhatsApp notifications disabled.");
}

module.exports = {
  notifyClients: async (entry) => {
    try {
      const clients = await User.find({ role: 'client' });
      
      for (const clientUser of clients) {
        // Send email (Only if transporter exists)
        if (transporter) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: clientUser.email,
            subject: 'New Inventory Entry Requires Review',
            html: `
              <p>A new inventory entry requires your review:</p>
              <ul>
                <li>SKU ID: ${entry.skuId}</li>
                <li>Gap: ${entry.auditResult}</li>
              </ul>
              <p>Please log in to the portal to review this entry.</p>
            `
          });
        }
        
        // Send WhatsApp (Only if client exists)
        if (client && clientUser.phone) {
          await client.messages.create({
            body: `New inventory entry requires review. SKU: ${entry.skuId}, Gap: ${entry.auditResult}`,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${clientUser.phone}`
          });
        }
      }
    } catch (error) {
      console.error('Error sending client notifications:', error);
    }
  },
  
  notifyClient: async (clientUser, entry) => {
    try {
      if (transporter) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: clientUser.email,
          subject: 'New Inventory Entry Requires Review',
          html: `
            <p>A new inventory entry requires your review:</p>
            <ul>
              <li>SKU ID: ${entry.skuId}</li>
              <li>Gap: ${entry.auditResult}</li>
            </ul>
            <p>Please log in to the portal to review this entry.</p>
          `
        });
      }
      
      if (client && clientUser.phone) {
        await client.messages.create({
          body: `New inventory entry requires review. SKU: ${entry.skuId}, Gap: ${entry.auditResult}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${clientUser.phone}`
        });
      }
    } catch (error) {
      console.error('Error sending client notification:', error);
    }
  },
  
  notifyStaff: async (entry, message) => {
    try {
      const staff = await User.findById(entry.staffId);
      if (!staff) return;

      if (transporter && staff.email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: staff.email,
          subject: 'Inventory Entry Update',
          html: `
            <p>${message}</p>
            <p>SKU ID: ${entry.skuId}</p>
            <p>Please log in to the portal for more details.</p>
          `
        });
      }
      
      if (client && staff.phone) {
        await client.messages.create({
          body: `${message} SKU ID: ${entry.skuId}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${staff.phone}`
        });
      }
    } catch (error) {
      console.error('Error sending staff notification:', error);
    }
  }
};
