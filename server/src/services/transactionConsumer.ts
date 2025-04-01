import type { Channel, ConsumeMessage } from 'amqplib';
import amqp from 'amqplib';
import { DBTransaction, DBTransactionType } from '../types';
import { insertToken, updateToken, updateTokenHolder } from '../db/tokens';
import { insertTransaction } from '../db/transactions';
import { moveFileFromTempToActiveGroup } from '../pinata';

const queue = 'transaction_queue';
let connection: any = null;
let channel: Channel | null = null;

async function connectTransactionQueue() {
    try {
        // Use credentials from environment variables or defaults
        const username = process.env.RABBITMQ_USER || 'admin';
        const password = process.env.RABBITMQ_PASS || 'admin';
        const host = process.env.RABBITMQ_HOST || 'localhost';
        const port = process.env.RABBITMQ_PORT || '5672';

        const url = `amqp://${username}:${password}@${host}:${port}`;
        connection = await amqp.connect(url);
        if (!connection) throw new Error('Failed to create RabbitMQ connection');

        channel = await connection.createChannel();
        if (!channel) throw new Error('Failed to create channel');

        await channel.assertQueue(queue, { durable: true });

        console.log('Connected to RabbitMQ');
        return channel;
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
        throw error;
    }
}

async function consumeMessages() {
    try {
        if (!channel) {
            channel = await connectTransactionQueue();
        }

        await channel.consume(queue, async (data: ConsumeMessage | null) => {
            if (!data) return;

            try {
                const transaction: DBTransaction = JSON.parse(data.content.toString());
                console.log('\n=== New Transaction Detected ===');
                console.log(`Transaction ID: ${transaction.id}`);
                console.log(`Type: ${transaction.type}`);
                console.log(`Block Number: ${transaction.block_number}`);
                console.log(`Timestamp: ${transaction.timestamp}`);
                console.log(`From: ${transaction.from_address}`);
                console.log(`To: ${transaction.to_address}`);
                console.log(`Amount: ${transaction.amount}`);
                console.log(`Success: ${transaction.success}`);
                console.log(`Token ID: ${transaction.token_id}`);
                console.log(`Token: ${transaction.token}`);
                console.log('================================\n');

                // begin processing the transaction and update the database
                if (transaction.type === DBTransactionType.CREATE) {
                    if (transaction.token) {
                        try {
                            await insertToken(transaction.token);
                            const imageUrl = transaction.token.image;
                            const imageCid = imageUrl.split('/').pop();
                            console.log('Image CID:', imageCid);
                            if (imageCid) {
                                await moveFileFromTempToActiveGroup(imageCid);
                            } else {
                                console.error('Image CID not found');
                            }
                        } catch (error) {
                            console.error('Error inserting token:', error);
                        }
                    } else {
                        console.error('Token not found in create transaction:', transaction);
                    }
                } else if (transaction.type === DBTransactionType.STEAL) {
                    if (transaction.token) {
                        try {
                            await updateToken(transaction.token);
                        } catch (error) {
                            console.error('Error updating token current_holder, current_price, next_price:', error);
                        }
                    } else {
                        console.error('Token not found in steal transaction:', transaction);
                    }
                } else if (transaction.type === DBTransactionType.TRANSFER) {
                    try {
                        await updateTokenHolder(transaction.token_id, transaction.to_address);
                    } catch (error) {
                        console.error('Error updating token current_holder:', error);
                    }
                }
                // add the transaction to the transaction db, update/do nothing if it already exists
                try {
                    await insertTransaction(transaction);
                } catch (error) {
                    console.error('Error inserting transaction:', error);
                }

                console.log('Transaction processed successfully');
                // Acknowledge the message
                channel?.ack(data);
            } catch (error) {
                console.error('Error processing message:', error);
                // Reject the message and requeue it
                channel?.nack(data, false, true);
            }
        });

        console.log('Consumer is listening for messages...');
    } catch (error) {
        console.error('Error in consumeMessages:', error);
        throw error;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down transaction consumer...');
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
consumeMessages().catch(error => {
    console.error('Failed to start consumer:', error);
    process.exit(1);
}); 