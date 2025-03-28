import amqp from 'amqplib';
import type { Channel } from 'amqplib';
import nodemailer from 'nodemailer';

const QUEUE_NAME = 'email_queue';
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

async function setupConsumer() {
  try {
    // Connect to RabbitMQ using environment variables
    const username = process.env.RABBITMQ_USER || 'admin';
    const password = process.env.RABBITMQ_PASS || 'admin';
    const host = process.env.RABBITMQ_HOST || 'localhost';
    const port = process.env.RABBITMQ_PORT || '5672';
    
    const url = `amqp://${username}:${password}@${host}:${port}`;
    connection = await amqp.connect(url);
    channel = await connection.createChannel();
    if (!channel) throw new Error('Failed to create channel');

    // Create queue if it doesn't exist
    await channel.assertQueue(QUEUE_NAME, {
      durable: true // Queue survives broker restart
    });

    // Set prefetch to 1 to ensure fair dispatch
    await channel.prefetch(1);

    // Start consuming messages
    await channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const emailData = JSON.parse(msg.content.toString());
        await processEmail(emailData);
        channel?.ack(msg);
      } catch (error) {
        console.error('Error processing email:', error);
        // Reject the message and requeue it
        channel?.nack(msg, false, true);
      }
    }, { noAck: false });

    console.log('Email consumer started successfully');
  } catch (error) {
    console.error('Error setting up email consumer:', error);
    throw error;
  }
}

interface EmailData {
  to: string;
  subject: string;
  content: string;
  template?: string;
  data?: Record<string, any>;
}

async function processEmail(emailData: EmailData) {
  try {
    let htmlContent = emailData.content;
    
    // If template is specified, render it with the provided data
    if (emailData.template && emailData.data) {
      // TODO: Implement template rendering logic
      // htmlContent = await renderTemplate(emailData.template, emailData.data);
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@fool.fun',
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent,
    });

    console.log(`Email sent successfully to ${emailData.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('Email consumer shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

// Initialize the consumer
setupConsumer().catch(error => {
  console.error('Failed to initialize email consumer:', error);
  process.exit(1);
}); 