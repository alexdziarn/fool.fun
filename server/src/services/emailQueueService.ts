import amqp from 'amqplib';
import type { Channel } from 'amqplib';
import { EmailData } from '../types';

const QUEUE_NAME = 'email_queue';
let connection: any = null;
let channel: Channel | null = null;

async function setupQueue() {
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

    console.log('Email queue service started successfully');
  } catch (error) {
    console.error('Error setting up email queue:', error);
    throw error;
  }
}

// Add an email to the queue
export async function queueEmail(emailData: EmailData) {
  try {
    if (!channel) {
      await setupQueue();
      if (!channel) throw new Error('Failed to setup queue');
    }

    const message = JSON.stringify(emailData);
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
      persistent: true // Message survives broker restart
    });
    
    console.log(`Queued email for ${emailData.to}`);
  } catch (error) {
    console.error(`Error queuing email for ${emailData.to}:`, error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('Email queue service shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

// Initialize the queue service
setupQueue().catch(error => {
  console.error('Failed to initialize email queue service:', error);
  process.exit(1);
}); 