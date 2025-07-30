/**
 * In-memory queue implementation for environments without Redis
 * This is a simplified version that mimics Bee-Queue's API for development use
 */
class MemoryQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.processing = false;
    this.processFunction = null;
    this.eventHandlers = {
      'succeeded': [],
      'failed': [],
      'error': [],
      'stalled': []
    };
    
    console.log(`Memory Queue '${name}' initialized`);
  }

  /**
   * Create a new job
   * @param {Object} data - The job data
   * @returns {Object} - Job object with save method
   */
  createJob(data) {
    return {
      data,
      save: async () => {
        const job = {
          id: Date.now() + Math.random().toString(36).substring(2, 9),
          data,
          status: 'created'
        };
        this.jobs.push(job);
        console.log(`Job ${job.id} created in queue ${this.name}`);
        
        // Start processing jobs if not already processing
        if (!this.processing && this.processFunction) {
          setTimeout(() => this._processNextJob(), 0);
        }
        
        return job;
      }
    };
  }

  /**
   * Set function to process jobs
   * @param {Function} fn - The function to process jobs
   */
  process(fn) {
    this.processFunction = fn;
    
    console.log(`Process handler registered for queue ${this.name}`);
    
    // Start processing any existing jobs
    if (this.jobs.length > 0 && !this.processing) {
      setTimeout(() => this._processNextJob(), 0);
    }
    
    return this;
  }

  /**
   * Process the next job in the queue
   * @private
   */
  async _processNextJob() {
    if (this.jobs.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const job = this.jobs.shift();
    job.status = 'processing';
    
    try {
      // Process the job with the registered function
      console.log(`Starting to process job ${job.id} in queue ${this.name}`);
      const result = await this.processFunction(job);
      job.status = 'completed';
      
      // Trigger success handlers
      this._triggerEvent('succeeded', job, result);
      
      // Process next job after a small delay
      setTimeout(() => this._processNextJob(), 10);
    } catch (error) {
      job.status = 'failed';
      console.error(`Error processing job ${job.id} in queue ${this.name}:`, error);
      
      // Trigger failure handlers
      this._triggerEvent('failed', job, error);
      
      // Continue processing next job despite error
      setTimeout(() => this._processNextJob(), 10);
    }
  }

  /**
   * Register an event handler
   * @param {string} event - The event name
   * @param {Function} handler - The event handler
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
    return this;
  }

  /**
   * Trigger event handlers
   * @param {string} event - The event name
   * @param {Object} job - The job
   * @param {*} data - Additional event data
   * @private
   */
  _triggerEvent(event, job, data) {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        try {
          handler(job, data);
        } catch (error) {
          console.error(`Error in ${event} handler for queue ${this.name}:`, error);
        }
      }
    }
  }

  /**
   * Close the queue
   */
  async close() {
    this.jobs = [];
    this.processing = false;
    return true;
  }
}

// Create queue instances for different document types
const assignmentProcessingQueue = new MemoryQueue('assignmentProcessing');
const rubricProcessingQueue = new MemoryQueue('rubricProcessing');
const solutionProcessingQueue = new MemoryQueue('solutionProcessing');
const submissionProcessingQueue = new MemoryQueue('submissionProcessing');
const evaluationQueue = new MemoryQueue('evaluation');

// Set up queue events for logging
const setupQueueEvents = (queue) => {
  queue.on('error', (err) => {
    console.error(`Queue ${queue.name} error:`, err);
  });

  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} in queue ${queue.name} failed:`, err);
  });

  queue.on('succeeded', (job, result) => {
    console.log(`Job ${job.id} in queue ${queue.name} completed successfully`);
  });
};

// Set up events for all queues
setupQueueEvents(assignmentProcessingQueue);
setupQueueEvents(rubricProcessingQueue);
setupQueueEvents(solutionProcessingQueue);
setupQueueEvents(submissionProcessingQueue);
setupQueueEvents(evaluationQueue);

module.exports = {
  assignmentProcessingQueue,
  rubricProcessingQueue,
  solutionProcessingQueue,
  submissionProcessingQueue,
  evaluationQueue,
};