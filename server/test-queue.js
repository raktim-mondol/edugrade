/**
 * Test script for the memory queue implementation
 * This script tests the memory queue implementation by creating and processing jobs
 */
const {
  assignmentProcessingQueue,
  rubricProcessingQueue,
  solutionProcessingQueue,
  submissionProcessingQueue,
  evaluationQueue
} = require('./config/queue');

console.log('Starting memory queue test...');

// Test job processing function for assignment queue
assignmentProcessingQueue.process(async (job) => {
  console.log(`[${new Date().toISOString()}] Processing test assignment job ${job.id}`, job.data);
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`[${new Date().toISOString()}] Assignment job ${job.id} completed`);
  return { status: 'success', message: 'Assignment processed successfully' };
});

// Test job processing function for rubric queue
rubricProcessingQueue.process(async (job) => {
  console.log(`[${new Date().toISOString()}] Processing test rubric job ${job.id}`, job.data);
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`[${new Date().toISOString()}] Rubric job ${job.id} completed`);
  return { status: 'success', message: 'Rubric processed successfully' };
});

// Test job processing function for solution queue
solutionProcessingQueue.process(async (job) => {
  console.log(`[${new Date().toISOString()}] Processing test solution job ${job.id}`, job.data);
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`[${new Date().toISOString()}] Solution job ${job.id} completed`);
  return { status: 'success', message: 'Solution processed successfully' };
});

// Test job processing function for submission queue
submissionProcessingQueue.process(async (job) => {
  console.log(`[${new Date().toISOString()}] Processing test submission job ${job.id}`, job.data);
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`[${new Date().toISOString()}] Creating evaluation job after submission processing`);
  // Create evaluation job after submission is processed
  await evaluationQueue.createJob({
    submissionId: 'test-submission-id',
    assignmentId: 'test-assignment-id',
    studentId: 'test-student-id'
  }).save();
  
  console.log(`[${new Date().toISOString()}] Submission job ${job.id} completed`);
  return { status: 'success', message: 'Submission processed successfully' };
});

// Test job processing function for evaluation queue
evaluationQueue.process(async (job) => {
  console.log(`[${new Date().toISOString()}] Processing test evaluation job ${job.id}`, job.data);
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`[${new Date().toISOString()}] Evaluation job ${job.id} completed`);
  return { status: 'success', message: 'Evaluation completed successfully' };
});

// Create test jobs
async function createTestJobs() {
  // Create assignment test job
  const assignmentJob = await assignmentProcessingQueue.createJob({
    assignmentId: 'test-assignment-id',
    extractedText: 'This is a test assignment'
  }).save();
  
  // Create rubric test job
  const rubricJob = await rubricProcessingQueue.createJob({
    assignmentId: 'test-assignment-id',
    extractedText: 'This is a test rubric'
  }).save();
  
  // Create solution test job
  const solutionJob = await solutionProcessingQueue.createJob({
    assignmentId: 'test-assignment-id',
    extractedText: 'This is a test solution'
  }).save();
  
  // Create submission test job
  const submissionJob = await submissionProcessingQueue.createJob({
    submissionId: 'test-submission-id',
    studentId: 'test-student-id',
    extractedText: 'This is a test submission'
  }).save();
  
  console.log('Test jobs created');
}

// Run the test
createTestJobs().then(() => {
  console.log('Memory queue test started');
  
  // Keep the process running for a while to allow jobs to complete
  setTimeout(() => {
    console.log('Memory queue test completed');
    process.exit(0);
  }, 15000);
}).catch(error => {
  console.error('Error running memory queue test:', error);
  process.exit(1);
});