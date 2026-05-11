import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Configure your email service
// Using Gmail: Create an App Password at https://myaccount.google.com/apppasswords
// Or use SendGrid, Mailgun, etc.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * POST /api/contact/submit
 * Handle contact form submission
 */
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, areaOfInterest, message } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !areaOfInterest || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.',
      });
    }

    // Email to GSC Intime team
    const mailToTeam = {
      from: process.env.EMAIL_USER,
      to: process.env.CONTACT_EMAIL_RECIPIENT || 'info@gscintime.com',
      subject: `New Contact Form Submission: ${areaOfInterest}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Area of Interest:</strong> ${areaOfInterest}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr />
        <p><small>Submitted on ${new Date().toLocaleString('en-IN')}</small></p>
      `,
    };

    // Send email to team only
    await transporter.sendMail(mailToTeam);

    res.json({
      success: true,
      message: 'Your enquiry has been submitted successfully. We will be in touch soon!',
    });
  } catch (error) {
    console.error('❌ Error sending contact email:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to submit enquiry. Please try again later.',
      error: error.message,
    });
  }
});

export default router;
