import mongoose from 'mongoose'

let dbReady = false

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-file-manager'

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
    } as mongoose.ConnectOptions)

    dbReady = true
    console.log('MongoDB connected successfully')
  } catch (error) {
    dbReady = false
    console.error('MongoDB connection failed:', error)
    throw error
  }
}

export function disconnectDB() {
  dbReady = false
  return mongoose.disconnect()
}

export function getDatabaseStatus() {
  return {
    connected: dbReady && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
  }
}
