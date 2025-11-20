const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { connectDB, isConnected } = require('./config/db');

// Import queue configuration
const { 
  assignmentProcessingQueue,
  rubricProcessingQueue, 
  solutionProcessingQueue, 
  submissionProcessingQueue, 
  evaluationQueue 
} = require('./config/queue');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection middleware for API routes
app.use('/api', (req, res, next) => {
  if (!isConnected()) {
    console.warn(`Database not connected for ${req.method} ${req.path}`);
    // Don't block all requests, just log warning
    // Some operations might work without database
  }
  next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure project submission directories exist
const projectCodeDir = path.join(__dirname, 'uploads', 'project-submissions', 'code');
const projectReportDir = path.join(__dirname, 'uploads', 'project-submissions', 'reports');
if (!fs.existsSync(projectCodeDir)) {
  fs.mkdirSync(projectCodeDir, { recursive: true });
}
if (!fs.existsSync(projectReportDir)) {
  fs.mkdirSync(projectReportDir, { recursive: true });
}

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define API routes
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/grademind', require('./routes/grademind'));

// Base route
app.get('/', (req, res) => {
  res.send('Assignment Evaluation System API is running');
});

// Start worker processes
if (process.env.NODE_ENV !== 'test') {
  // Load queue processors
  require('./workers/assignmentProcessor');
  require('./workers/rubricProcessor');
  require('./workers/solutionProcessor');
  require('./workers/submissionProcessor');
  require('./workers/evaluationProcessor');
  require('./workers/projectProcessor'); // Added project processor
  require('./workers/orchestrationProcessor'); // Added orchestration processor
  
  console.log('Document processing workers initialized');
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Send all other requests to the React app
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

// Define port for the server
const PORT = process.env.PORT || 5000; 

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});