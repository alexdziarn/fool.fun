import amqp from 'amqplib';
import type { Channel } from 'amqplib';

const QUEUE_NAME = 'upload_check_queue';
const DLQ_NAME = 'upload_check_dlq';
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

    // Create DLQ
    await channel.assertQueue(DLQ_NAME, {
      durable: true
    });

    // Create main queue with TTL and DLQ
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-message-ttl': 300000, // 5 minutes in milliseconds
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': DLQ_NAME
      }
    });

    console.log('Upload checker queue service started successfully');
  } catch (error) {
    console.error('Error setting up upload checker queue:', error);
    throw error;
  }
}

// Add a CID to the queue
export async function queueUploadCheck(cid: string) {
  try {
    if (!channel) {
      await setupQueue();
      if (!channel) throw new Error('Failed to setup queue');
    }

    const message = {
      cid,
      timestamp: new Date().toISOString()
    };

    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    
    console.log(`Queued CID ${cid} for upload check`);
  } catch (error) {
    console.error(`Error queuing CID ${cid}:`, error);
    throw error;
  }
}

// Start consuming messages from DLQ
export async function startDLQConsumer() {
  try {
    if (!channel) {
      await setupQueue();
      if (!channel) throw new Error('Failed to setup queue');
    }

    await channel.consume(DLQ_NAME, (msg) => {
      if (msg) {
        try {
          const { cid } = JSON.parse(msg.content.toString());
          console.log(`CID ${cid} has been in queue for 5 minutes`);
          channel?.ack(msg);
          // TODO: Check if the CID is in the temp group
          // TODO: If it is delete it from the temp group and pinata
          // TODO: If it is not, do nothing
        } catch (error) {
          console.error('Error processing DLQ message:', error);
          channel?.nack(msg);
        }
      }
    });

    console.log('DLQ consumer started successfully');
  } catch (error) {
    console.error('Error starting DLQ consumer:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('Upload checker queue service shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

// Initialize the queue service
setupQueue()
  .then(() => startDLQConsumer())
  .catch(error => {
    console.error('Failed to initialize upload checker queue service:', error);
    process.exit(1);
  }); 