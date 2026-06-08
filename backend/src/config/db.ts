import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('MongoDB connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('querySrv')) {
      console.error(
        'MongoDB connection error: DNS SRV lookup failed for mongodb+srv URI.\n' +
          'Fix: In MongoDB Atlas go to Connect -> Drivers and copy the standard connection string (mongodb://...),\n' +
          'or add directConnection=true to a single shard host. Then update MONGO_URI in backend/.env'
      );
    } else {
      console.error('MongoDB connection error:', error);
    }

    process.exit(1);
  }
}
