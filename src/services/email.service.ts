import nodemailer from 'nodemailer';
import { environment } from '../config/environment';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: environment.email.service,
      auth: {
        user: environment.email.user,
        pass: environment.email.password,
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: environment.email.user,
      to: email,
      subject: 'Your Verification Code - Bubblemaps Bot',
      html: `
        <h1>Welcome to Bubblemaps Bot!</h1>
        <p>Your verification code is:</p>
        <h2 style="font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">${code}</h2>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending verification code:', error);
      throw new Error('Failed to send verification code');
    }
  }

  async resendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: environment.email.user,
      to: email,
      subject: 'New Verification Code - Bubblemaps Bot',
      html: `
        <h1>New Verification Code</h1>
        <p>Your new verification code is:</p>
        <h2 style="font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">${code}</h2>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request a new code, please ignore this email.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending new verification code:', error);
      throw new Error('Failed to send new verification code');
    }
  }
}

export const emailService = new EmailService(); 