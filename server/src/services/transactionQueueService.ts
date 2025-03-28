import amqp from 'amqplib';
import type { Channel } from 'amqplib';
import { DBTransaction } from '../types';

const QUEUE_NAME = 'transaction_queue';
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

    console.log('Queue service started successfully');
  } catch (error) {
    console.error('Error setting up queue:', error);
    throw error;
  }
}

// Add a transaction to the queue
export async function queueTransactionUpdate(transaction: DBTransaction) {
  try {
    if (!channel) {
      await setupQueue();
      if (!channel) throw new Error('Failed to setup queue');
    }

    const message = JSON.stringify(transaction);
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
      persistent: true // Message survives broker restart
    });
    
    console.log(`Queued transaction ${transaction.id} for processing`);
  } catch (error) {
    console.error(`Error queuing transaction ${transaction.id}:`, error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('Queue service shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

// Initialize the queue service
setupQueue().catch(error => {
  console.error('Failed to initialize queue service:', error);
  process.exit(1);
}); 