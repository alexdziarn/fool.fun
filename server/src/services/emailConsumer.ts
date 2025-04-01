import amqp from 'amqplib';
import type { Channel } from 'amqplib';
import nodemailer from 'nodemailer';
import { EmailData } from '../types';
import { Account, getAccountById, getEmailPreferences } from '../db/accounts';
import { getPool } from '../db/pool';

const queue = 'email_queue';
let connection: any = null;
let channel: Channel | null = null;

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
});

async function connectEmailQueue() {
  try {
    // Connect to RabbitMQ using environment variables
    const username = process.env.RABBITMQ_USER || 'admin';
    const password = process.env.RABBITMQ_PASS || 'admin';
    const host = process.env.RABBITMQ_HOST || 'localhost';
    const port = process.env.RABBITMQ_PORT || '5672';
    
    const url = `amqp://${username}:${password}@${host}:${port}`;
    connection = await amqp.connect(url);
    if (!connection) throw new Error('Failed to create RabbitMQ connection');

    channel = await connection.createChannel();
    if (!channel) throw new Error('Failed to create channel');

    // Create queue if it doesn't exist
    await channel.assertQueue(queue, { durable: true });

    console.log('Email consumer started successfully');
    return channel;
  } catch (error) {
    console.error('Error setting up email consumer:', error);
    throw error;
  }
}

async function processEmail(emailData: EmailData) {
  try {
    // TODO: Implement a better template system
    sendEmailToAccount(emailData);
    sendEmailFromAccount(emailData);
  } catch (error) {
    console.error('Error processing email:', error);
  }
}

// may need to flip with from account
async function sendEmailToAccount(emailData: EmailData) {
  const account = await getAccountById(emailData.to);
  if(!account || !account.email) return;

  const emailPreferences = await getEmailPreferences(account.email);
  if(!emailPreferences) return;

  if(emailPreferences.steal && emailData.type === 'steal') {
    const htmlContent = `
      <p>You have successfully stolen ${emailData.token_id} from ${emailData.from} for ${emailData.amount} SOL.</p>
    `;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@fool.fun',
        to: account.email,
        subject: 'You have successfully stolen a token',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email steal email:', error);
    }
  } else if(emailPreferences.transfer && emailData.type === 'transfer') {
    const htmlContent = `
      <p>You have received ${emailData.token_id} from ${emailData.from}.</p>
    `;
    try{
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@fool.fun',
        to: account.email,
        subject: 'You have received a token',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email transfer email:', error);
    }
  } else if(emailPreferences.create && emailData.type === 'create') {
    const htmlContent = `
      <p>You have successfully created token ${emailData.token_id}.</p>
    `;
    try{
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@fool.fun',
        to: account.email,
        subject: 'You have created a token',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email create email:', error);
    }
  }
}

async function sendEmailFromAccount(emailData: EmailData) {
  const account = await getAccountById(emailData.from);
  if(!account || !account.email) return;

  const emailPreferences = await getEmailPreferences(account.email);
  if(!emailPreferences) return;

  if(emailPreferences.steal && emailData.type === 'steal') {
    const htmlContent = `
      <p>Token ${emailData.token_id} has been stolen from you by ${emailData.to} for ${emailData.amount} SOL.</p>
    `;
    try{
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@fool.fun',
        to: account.email,
        subject: 'A token has been stolen from you',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email steal email:', error);
    }
  } else if(emailPreferences.transfer && emailData.type === 'transfer') {
    const htmlContent = `
      <p>Token ${emailData.token_id} has been transferred to you by ${emailData.to}.</p>
    `;
    try{
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@fool.fun',
        to: account.email,
        subject: 'A token has been transferred to you',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email transfer email:', error);
    }
  }
}


// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down email consumer...');
    if (channel) await channel.close();
    if (connection) {
        try {
            await connection.close();
        } catch (error) {
            console.error('Error closing connection:', error);
        }
    }
    process.exit(0);
});

// Start consuming messages
connectEmailQueue().catch(error => {
  console.error('Failed to initialize email consumer:', error);
  process.exit(1);
}); 