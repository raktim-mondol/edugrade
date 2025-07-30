const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edugrade';
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      maxPoolSize: 10, // Maintain up to 10 socket connections
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Add connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.log('Will continue without database connection - some features may not work');
    // Don't exit the process in production, just log the error
    if (process.env.NODE_ENV !== 'production') {
      console.log('Consider starting MongoDB service: mongod --dbpath /path/to/your/db');
    }
    return null;
  }
};

// Function to check if database is connected
const isConnected = () => {
  return mongoose.connection && mongoose.connection.readyState === 1;
};

module.exports = { connectDB, isConnected };