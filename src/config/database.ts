import mongoose from 'mongoose';
import { environment } from './environment';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(environment.mongodb.uri, {
      dbName: environment.mongodb.dbName,
    });
    
    console.log('Successfully connected to MongoDB.');
    
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected.');
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};
