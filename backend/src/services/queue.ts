import amqp from 'amqplib'

let channel: amqp.Channel | null = null
let connection: amqp.ChannelModel | null = null
let queueReady = false

const QUEUE_NAMES = {
  STEGO_EMBED: 'stego.embed',
  STEGO_EXTRACT: 'stego.extract',
} as const

export async function initQueue() {
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    )

    channel = await connection.createChannel()

    for (const queueName of Object.values(QUEUE_NAMES)) {
      await channel.assertQueue(queueName, { durable: true })
    }

    queueReady = true
    console.log('RabbitMQ connected successfully')
  } catch (error) {
    queueReady = false
    console.error('RabbitMQ connection failed:', error)
    throw error
  }
}

export function getChannel(): amqp.Channel {
  if (!channel) {
    throw new Error('Message queue not initialized')
  }
  return channel
}

export const QueueNames = QUEUE_NAMES

export async function enqueueJob(
  queueName: string,
  payload: Record<string, unknown>,
) {
  const ch = getChannel()
  const message = Buffer.from(JSON.stringify(payload))
  ch.sendToQueue(queueName, message, { persistent: true })
}

export async function closeQueue() {
  queueReady = false
  if (channel) {
    await channel.close()
    channel = null
  }
  if (connection) {
    await connection.close()
    connection = null
  }
}

export function getQueueStatus() {
  return {
    connected: queueReady && channel !== null,
  }
}
