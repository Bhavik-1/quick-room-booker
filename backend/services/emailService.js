// backend/services/emailService.js

import nodemailer from "nodemailer";
import "dotenv/config";

// Create transporter using Gmail SMTP
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD,
//   },
// });
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Explicitly set host
  port: 587,
  secure: false, // Use SSL/TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Increase timeout to 30 seconds to prevent immediate failure
  // (Render defaults are sometimes too fast)
  connectionTimeout: 30000, 
  socketTimeout: 30000,
});

/**
 * Format date to readable string
 * @param {string} dateString - Date string from database
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Send approval email to user
 * @param {string} userEmail - Recipient email address
 * @param {string} userName - User's name for personalization
 * @param {object} bookingDetails - Booking information
 * @returns {Promise<boolean>} Success status
 */
export async function sendApprovalEmail(userEmail, userName, bookingDetails) {
  try {
    const { roomName, date, startTime, endTime, duration, purpose } =
      bookingDetails;
    const formattedDate = formatDate(date);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Approved</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <h2 style="color: #28a745; margin-bottom: 20px;">✓ Booking Approved</h2>

  <p>Hi ${userName},</p>

  <p>Great news! Your room booking has been approved.</p>

  <div style="background: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 30%;">Room:</td>
        <td style="padding: 8px 0;">${roomName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Date:</td>
        <td style="padding: 8px 0;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Time:</td>
        <td style="padding: 8px 0;">${startTime} - ${endTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
        <td style="padding: 8px 0;">${duration} hour(s)</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Purpose:</td>
        <td style="padding: 8px 0;">${purpose}</td>
      </tr>
    </table>
  </div>

  <p>Your room is confirmed and ready for use. We look forward to seeing you!</p>

  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
    Quick Room Booker<br>
    This is an automated message, please do not reply.
  </p>
</body>
</html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Room Booking Approved - ${roomName}`,
      html: htmlContent,
    });

    console.log(`✅ Approval email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send approval email to ${userEmail}:`,
      error.message
    );
    return false;
  }
}

/**
 * Send rejection email to user
 * @param {string} userEmail - Recipient email address
 * @param {string} userName - User's name for personalization
 * @param {object} bookingDetails - Booking information
 * @param {string|null} rejectionReason - Optional admin reason for rejection
 * @returns {Promise<boolean>} Success status
 */
export async function sendRejectionEmail(
  userEmail,
  userName,
  bookingDetails,
  rejectionReason
) {
  try {
    const { roomName, date, startTime, endTime, duration, purpose } =
      bookingDetails;
    const formattedDate = formatDate(date);

    // Conditionally include reason section
    const reasonSection = rejectionReason
      ? `
<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
  <h4 style="margin-top: 0; color: #856404;">Reason</h4>
  <p style="margin: 0; color: #856404;">${rejectionReason}</p>
</div>
    `
      : "";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <h2 style="color: #dc3545; margin-bottom: 20px;">Room Booking Update</h2>

  <p>Hi ${userName},</p>

  <p>We're sorry to inform you that your room booking could not be approved at this time.</p>

  <div style="background: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 30%;">Room:</td>
        <td style="padding: 8px 0;">${roomName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Date:</td>
        <td style="padding: 8px 0;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Time:</td>
        <td style="padding: 8px 0;">${startTime} - ${endTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
        <td style="padding: 8px 0;">${duration} hour(s)</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Purpose:</td>
        <td style="padding: 8px 0;">${purpose}</td>
      </tr>
    </table>
  </div>

  ${reasonSection}

  <p>You're welcome to submit a new booking request. If you have questions, please contact the administrator.</p>

  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
    Quick Room Booker<br>
    This is an automated message, please do not reply.
  </p>
</body>
</html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Room Booking Update - ${roomName}`,
      html: htmlContent,
    });

    console.log(`✅ Rejection email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send rejection email to ${userEmail}:`,
      error.message
    );
    return false;
  }
}

/**
 * Send override cancellation email to user
 * @param {string} userEmail - Recipient email address
 * @param {string} userName - User's name for personalization
 * @param {object} cancelledBooking - Details of their cancelled booking
 * @param {object} newBooking - Details of the new booking that caused cancellation
 * @returns {Promise<boolean>} Success status
 */
export async function sendOverrideCancellationEmail(
  userEmail,
  userName,
  cancelledBooking,
  newBooking
) {
  try {
    const { roomName, date, startTime, endTime, duration, purpose } =
      cancelledBooking;
    const formattedDate = formatDate(date);
    const formattedNewDate = formatDate(newBooking.date);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Cancelled - Admin Override</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <h2 style="color: #dc3545; margin-bottom: 20px;">Room Booking Cancelled - Admin Override</h2>

  <p>Hi ${userName},</p>

  <p>We're sorry to inform you that your room booking has been cancelled due to an admin override.</p>

  <div style="background: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #333;">Your Cancelled Booking</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 30%;">Room:</td>
        <td style="padding: 8px 0;">${roomName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Date:</td>
        <td style="padding: 8px 0;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Time:</td>
        <td style="padding: 8px 0;">${startTime} - ${endTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
        <td style="padding: 8px 0;">${duration} hour(s)</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Purpose:</td>
        <td style="padding: 8px 0;">${purpose}</td>
      </tr>
    </table>
  </div>

  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404;">Conflicting Booking Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 30%;">Reason:</td>
        <td style="padding: 8px 0; color: #856404;">Admin Force-Approved Conflicting Booking</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Approved by:</td>
        <td style="padding: 8px 0; color: #856404;">${newBooking.adminName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">New booking purpose:</td>
        <td style="padding: 8px 0; color: #856404;">${newBooking.purpose}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Date:</td>
        <td style="padding: 8px 0; color: #856404;">${formattedNewDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Time:</td>
        <td style="padding: 8px 0; color: #856404;">${newBooking.startTime} - ${newBooking.endTime}</td>
      </tr>
    </table>
  </div>

  <p>You're welcome to submit a new booking request for a different time slot. If you have questions about this cancellation, please contact the administrator.</p>

  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
    Quick Room Booker<br>
    This is an automated message, please do not reply.
  </p>
</body>
</html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Room Booking Cancelled - Admin Override - ${roomName}`,
      html: htmlContent,
    });

    console.log(`✅ Override cancellation email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send override cancellation email to ${userEmail}:`,
      error.message
    );
    return false;
  }
}

export default transporter;
