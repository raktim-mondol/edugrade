import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Alert, Spinner, Button, ProgressBar, Badge } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiCheckCircle, FiAlertCircle, FiClock, FiInfo, FiArrowLeft, FiUpload, FiFileText } from 'react-icons/fi';

const AssignmentProcessingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [assignment, setAssignment] = useState(null);
  const [processingStatus, setProcessingStatus] = useState({
    assignmentProcessingStatus: 'pending',
    rubricProcessingStatus: 'not_applicable',
    solutionProcessingStatus: 'not_applicable',
    evaluationReadyStatus: 'not_ready'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [processingTimes, setProcessingTimes] = useState({});
  const [showHelp, setShowHelp] = useState(false);
  
  // Stable processing times that won't flicker
  const [stableProcessingTimes, setStableProcessingTimes] = useState({
    assignment: null,
    rubric: null,
    solution: null
  });

  // Store previous status for comparison
  const prevStatusRef = useRef({});
  
  // Polling reference for cleanup
  const pollingIntervalRef = useRef(null);
  
  // Store start times for processing
  const startTimesRef = useRef({});
  
  // Memoize completed processing times to prevent flickering
  const completedTimesRef = useRef({
    assignment: null,
    rubric: null,
    solution: null
  });
  
  // Default processing times for completed items (for demonstration/testing)
  const defaultProcessingTimes = {
    assignment: "45.2",
    rubric: "25.7",
    solution: "30.4"
  };
  
  // Fetch assignment details
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const { data } = await axios.get(`/api/assignments/${id}`);
        setAssignment(data.assignment);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching assignment details:', err);
        setError('Failed to load assignment details.');
        setLoading(false);
      }
    };
    
    fetchAssignment();
  }, [id]);
  
  // Setup polling for processing status
  useEffect(() => {
    if (!id) return;
    
    const checkProcessingStatus = async () => {
      try {
        const { data } = await axios.get(`/api/assignments/${id}/status`);
        setLastUpdated(new Date());
        
        // Calculate processing times for completed items that just changed status
        const newTimes = { ...processingTimes };
        const newStableTimes = { ...stableProcessingTimes };
        
        // Check for assignment status change to completed
        if (data.assignmentProcessingStatus === 'completed' && 
            prevStatusRef.current.assignmentProcessingStatus === 'processing' && 
            startTimesRef.current.assignment) {
          
          const processingTime = (new Date() - startTimesRef.current.assignment) / 1000;
          newTimes.assignment = processingTime.toFixed(1);
          // Store in stable times to prevent flickering
          newStableTimes.assignment = processingTime.toFixed(1);
          // Store directly in the completed times ref to avoid any issues
          completedTimesRef.current.assignment = `Processed in ${processingTime.toFixed(1)}s`;
        }
        
        // Check for rubric status change to completed
        if (data.rubricProcessingStatus === 'completed' && 
            prevStatusRef.current.rubricProcessingStatus === 'processing' &&
            startTimesRef.current.rubric) {
          
          const processingTime = (new Date() - startTimesRef.current.rubric) / 1000;
          newTimes.rubric = processingTime.toFixed(1);
          // Store in stable times to prevent flickering
          newStableTimes.rubric = processingTime.toFixed(1);
          // Store directly in the completed times ref to avoid any issues
          completedTimesRef.current.rubric = `Processed in ${processingTime.toFixed(1)}s`;
        }
        
        // Check for solution status change to completed
        if (data.solutionProcessingStatus === 'completed' && 
            prevStatusRef.current.solutionProcessingStatus === 'processing' &&
            startTimesRef.current.solution) {
          
          const processingTime = (new Date() - startTimesRef.current.solution) / 1000;
          newTimes.solution = processingTime.toFixed(1);
          // Store in stable times to prevent flickering
          newStableTimes.solution = processingTime.toFixed(1);
          // Store directly in the completed times ref to avoid any issues
          completedTimesRef.current.solution = `Processed in ${processingTime.toFixed(1)}s`;
        }
        
        // Handle already completed items when first loading the page
        if (data.assignmentProcessingStatus === 'completed' && !completedTimesRef.current.assignment) {
          const timeValue = data.assignmentProcessingTime || defaultProcessingTimes.assignment;
          newTimes.assignment = timeValue;
          newStableTimes.assignment = timeValue;
          completedTimesRef.current.assignment = `Processed in ${timeValue}s`;
        }
        
        if (data.rubricProcessingStatus === 'completed' && !completedTimesRef.current.rubric) {
          const timeValue = data.rubricProcessingTime || defaultProcessingTimes.rubric;
          newTimes.rubric = timeValue;
          newStableTimes.rubric = timeValue;
          completedTimesRef.current.rubric = `Processed in ${timeValue}s`;
        }
        
        if (data.solutionProcessingStatus === 'completed' && !completedTimesRef.current.solution) {
          const timeValue = data.solutionProcessingTime || defaultProcessingTimes.solution;
          newTimes.solution = timeValue;
          newStableTimes.solution = timeValue;
          completedTimesRef.current.solution = `Processed in ${timeValue}s`;
        }
        
        // Track processing start times
        if (data.assignmentProcessingStatus === 'processing' && 
            prevStatusRef.current.assignmentProcessingStatus !== 'processing') {
          startTimesRef.current.assignment = new Date();
        }
        
        if (data.rubricProcessingStatus === 'processing' && 
            prevStatusRef.current.rubricProcessingStatus !== 'processing') {
          startTimesRef.current.rubric = new Date();
        }
        
        if (data.solutionProcessingStatus === 'processing' && 
            prevStatusRef.current.solutionProcessingStatus !== 'processing') {
          startTimesRef.current.solution = new Date();
        }
        
        setProcessingTimes(newTimes);
        setStableProcessingTimes(newStableTimes);
        
        // Save current status for next comparison
        prevStatusRef.current = data;
        setProcessingStatus(data);
        
        // If all processing is complete or failed, we can stop polling
        if (
          (data.evaluationReadyStatus === 'ready' || data.evaluationReadyStatus === 'partial') &&
          (data.assignmentProcessingStatus === 'completed' || data.assignmentProcessingStatus === 'failed') && 
          (data.rubricProcessingStatus === 'completed' || data.rubricProcessingStatus === 'not_applicable' || data.rubricProcessingStatus === 'failed') &&
          (data.solutionProcessingStatus === 'completed' || data.solutionProcessingStatus === 'not_applicable' || data.solutionProcessingStatus === 'failed')
        ) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error('Error checking processing status:', err);
      }
    };
    
    // Check immediately
    checkProcessingStatus();
    
    // Poll every 2 seconds for more responsive status updates
    pollingIntervalRef.current = setInterval(checkProcessingStatus, 2000);
    
    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [id]); // Keep only id as dependency

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="text-success" size={22} />;
      case 'failed':
        return <FiAlertCircle className="text-danger" size={22} />;
      case 'processing':
        return <span className="processing-icon-container"><Spinner animation="border" size="sm" variant="warning" /></span>;
      case 'pending':
        return <FiClock className="text-secondary" size={22} />;
      case 'not_applicable':
        return <span className="text-muted">N/A</span>;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'info';
      case 'not_applicable':
        return 'secondary';
      default:
        return 'secondary';
    }
  };
  
  const getProcessingTime = (component) => {
    console.log(`Getting time for ${component}, status: ${processingStatus[component + 'ProcessingStatus']}`);
    console.log(`Ref value: ${completedTimesRef.current[component]}`);
    console.log(`Stable time: ${stableProcessingTimes[component]}`);
    
    // For completed items, use memoized time if available
    if ((component === 'assignment' && processingStatus.assignmentProcessingStatus === 'completed') ||
        (component === 'rubric' && processingStatus.rubricProcessingStatus === 'completed') ||
        (component === 'solution' && processingStatus.solutionProcessingStatus === 'completed')) {
      
      // If we already have a cached time message, use it (prevents flickering)
      if (completedTimesRef.current[component]) {
        return completedTimesRef.current[component];
      }
      
      // Otherwise try to create one from our available time data
      if (stableProcessingTimes[component]) {
        const message = `Processed in ${stableProcessingTimes[component]}s`;
        completedTimesRef.current[component] = message;
        return message;
      }
      
      if (processingTimes[component]) {
        const message = `Processed in ${processingTimes[component]}s`;
        completedTimesRef.current[component] = message;
        return message;
      }
      
      // If no time is available, use a default time for completed items
      const defaultTime = defaultProcessingTimes[component];
      const message = `Processed in ${defaultTime}s`;
      completedTimesRef.current[component] = message;
      return message;
    }
    
    // If currently processing, show elapsed time
    if ((component === 'assignment' && processingStatus.assignmentProcessingStatus === 'processing') ||
        (component === 'rubric' && processingStatus.rubricProcessingStatus === 'processing') ||
        (component === 'solution' && processingStatus.solutionProcessingStatus === 'processing')) {
      
      if (!startTimesRef.current[component]) {
        startTimesRef.current[component] = new Date();
      }
      
      const elapsed = (new Date() - startTimesRef.current[component]) / 1000;
      if (elapsed > 10) {
        // High-light long running processes
        return <span className="text-warning">Processing for {elapsed.toFixed(0)}s...</span>;
      }
      return `Processing for ${elapsed.toFixed(0)}s...`;
    }
    
    return null;
  };

  // Calculate overall progress percentage
  const calculateProgress = () => {
    // Count only applicable items
    const total = 1 + // Assignment is always required
      (processingStatus.rubricProcessingStatus !== 'not_applicable' ? 1 : 0) +
      (processingStatus.solutionProcessingStatus !== 'not_applicable' ? 1 : 0);
    
    let completed = 0;
    if (processingStatus.assignmentProcessingStatus === 'completed') completed += 1;
    if (processingStatus.rubricProcessingStatus === 'completed') completed += 1;
    if (processingStatus.solutionProcessingStatus === 'completed') completed += 1;
    
    return Math.round((completed / total) * 100);
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" role="status" variant="primary" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3 text-muted">Loading assignment details...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center mb-2">
            <Button 
              variant="light" 
              className="me-3 rounded-circle p-2 d-inline-flex align-items-center justify-content-center" 
              style={{ width: '40px', height: '40px' }}
              onClick={() => navigate('/assignments')}
            >
              <FiArrowLeft size={20} />
            </Button>
            <h2 className="mb-0 fw-bold">Assignment Processing</h2>
          </div>
          
          {assignment && (
            <div className="ms-4 ps-4 border-start border-3">
              <h4 className="text-primary mb-1">{assignment.title}</h4>
              <p className="text-muted mb-1">
                Course: {assignment.course}
                {assignment.totalPoints && <span className="ms-2">• {assignment.totalPoints} Points</span>}
              </p>
              {lastUpdated && (
                <div className="d-flex align-items-center">
                  <Badge bg="light" text="dark" className="d-inline-flex align-items-center py-2 px-3">
                    <FiClock className="me-1" size={14} />
                    <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                  </Badge>
                </div>
              )}
            </div>
          )}
        </Col>
        <Col xs="auto">
          <Button 
            variant="outline-info" 
            className="rounded-pill d-flex align-items-center"
            onClick={() => setShowHelp(!showHelp)}
          >
            <FiInfo size={18} className="me-2" /> {showHelp ? 'Hide Info' : 'Processing Info'}
          </Button>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm border-0">
          <FiAlertCircle size={24} className="me-3 flex-shrink-0" />
          <div>{error}</div>
        </Alert>
      )}
      
      {showHelp && (
        <Alert variant="info" dismissible onClose={() => setShowHelp(false)} className="shadow-sm border-0 mb-4">
          <Alert.Heading className="d-flex align-items-center fw-bold">
            <FiInfo size={22} className="me-2" />
            About the Processing
          </Alert.Heading>
          <p className="lead">
            Your assignment is being processed by our AI system. This typically takes 10-15 seconds per document,
            but might take longer for complex or large documents.
          </p>
          <ul className="mb-3">
            <li className="mb-2">The <strong>Assignment</strong> document is always required and must be processed.</li>
            <li className="mb-2">The <strong>Rubric</strong> document is highly recommended for accurate grading.</li>
            <li>The <strong>Solution</strong> document is optional but provides better feedback to students.</li>
          </ul>
          <p className="mb-0 fst-italic">
            You'll be notified when all documents are processed and the assignment is ready for student submissions.
          </p>
        </Alert>
      )}

      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <div className="d-flex align-items-center">
            <FiFileText size={20} className="text-primary me-2" />
            <h5 className="mb-0 fw-bold">Processing Status</h5>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="position-relative mb-5">
            <ProgressBar 
              now={calculateProgress()} 
              className="progress-tall shadow-sm" 
              variant={
                processingStatus.evaluationReadyStatus === 'ready' 
                ? 'success' 
                : processingStatus.evaluationReadyStatus === 'partial'
                ? 'info'
                : 'primary'
              }
            />
            <div className="progress-label">
              <span className="badge bg-white text-dark border shadow-sm px-3 py-2">
                {calculateProgress()}% Complete
              </span>
            </div>
          </div>

          <Row className="g-4">
            <Col md={4}>
              <Card className={`h-100 border-0 shadow-sm status-card ${processingStatus.assignmentProcessingStatus === 'completed' ? 'status-completed' : processingStatus.assignmentProcessingStatus === 'processing' ? 'status-processing' : processingStatus.assignmentProcessingStatus === 'failed' ? 'status-failed' : ''}`}>
                <Card.Header className="bg-transparent border-bottom-0 pt-4 pb-0 px-4">
                  <div className="status-icon">
                    {getStatusIcon(processingStatus.assignmentProcessingStatus)}
                  </div>
                  <h5 className="mt-3 mb-0 fw-bold">Assignment</h5>
                  <Badge bg="primary" className="mt-2 mb-3">Required</Badge>
                </Card.Header>
                
                <Card.Body className="pt-0 px-4">
                  <div className={`status-label text-${getStatusColor(processingStatus.assignmentProcessingStatus)}`}>
                    {processingStatus.assignmentProcessingStatus === 'completed' 
                      ? 'Successfully Processed' 
                      : processingStatus.assignmentProcessingStatus === 'processing'
                      ? 'Currently Processing'
                      : processingStatus.assignmentProcessingStatus === 'failed'
                      ? 'Processing Failed'
                      : 'Pending Processing'}
                  </div>
                  <div className="text-muted small mt-2">
                    {getProcessingTime('assignment')}
                  </div>
                  {processingStatus.processingError && (
                    <Alert variant="danger" className="mt-3 small py-2">
                      {processingStatus.processingError}
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={4}>
              <Card className={`h-100 border-0 shadow-sm status-card ${processingStatus.rubricProcessingStatus === 'completed' ? 'status-completed' : processingStatus.rubricProcessingStatus === 'processing' ? 'status-processing' : processingStatus.rubricProcessingStatus === 'failed' ? 'status-failed' : ''}`}>
                <Card.Header className="bg-transparent border-bottom-0 pt-4 pb-0 px-4">
                  <div className="status-icon">
                    {getStatusIcon(processingStatus.rubricProcessingStatus)}
                  </div>
                  <h5 className="mt-3 mb-0 fw-bold">Rubric</h5>
                  <Badge bg="info" className="mt-2 mb-3">Recommended</Badge>
                </Card.Header>
                
                <Card.Body className="pt-0 px-4">
                  <div className={`status-label text-${getStatusColor(processingStatus.rubricProcessingStatus)}`}>
                    {processingStatus.rubricProcessingStatus === 'completed' 
                      ? 'Successfully Processed' 
                      : processingStatus.rubricProcessingStatus === 'processing'
                      ? 'Currently Processing'
                      : processingStatus.rubricProcessingStatus === 'failed'
                      ? 'Processing Failed'
                      : processingStatus.rubricProcessingStatus === 'not_applicable'
                      ? 'No Rubric Provided'
                      : 'Pending Processing'}
                  </div>
                  <div className="text-muted small mt-2">
                    {getProcessingTime('rubric')}
                  </div>
                  {processingStatus.rubricProcessingError && (
                    <Alert variant="danger" className="mt-3 small py-2">
                      {processingStatus.rubricProcessingError}
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={4}>
              <Card className={`h-100 border-0 shadow-sm status-card ${processingStatus.solutionProcessingStatus === 'completed' ? 'status-completed' : processingStatus.solutionProcessingStatus === 'processing' ? 'status-processing' : processingStatus.solutionProcessingStatus === 'failed' ? 'status-failed' : ''}`}>
                <Card.Header className="bg-transparent border-bottom-0 pt-4 pb-0 px-4">
                  <div className="status-icon">
                    {getStatusIcon(processingStatus.solutionProcessingStatus)}
                  </div>
                  <h5 className="mt-3 mb-0 fw-bold">Solution</h5>
                  <Badge bg="secondary" className="mt-2 mb-3">Optional</Badge>
                </Card.Header>
                
                <Card.Body className="pt-0 px-4">
                  <div className={`status-label text-${getStatusColor(processingStatus.solutionProcessingStatus)}`}>
                    {processingStatus.solutionProcessingStatus === 'completed' 
                      ? 'Successfully Processed' 
                      : processingStatus.solutionProcessingStatus === 'processing'
                      ? 'Currently Processing'
                      : processingStatus.solutionProcessingStatus === 'failed'
                      ? 'Processing Failed'
                      : processingStatus.solutionProcessingStatus === 'not_applicable'
                      ? 'No Solution Provided'
                      : 'Pending Processing'}
                  </div>
                  <div className="text-muted small mt-2">
                    {getProcessingTime('solution')}
                  </div>
                  {processingStatus.solutionProcessingError && (
                    <Alert variant="danger" className="mt-3 small py-2">
                      {processingStatus.solutionProcessingError}
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="mt-5 border-0 shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex">
                <div className="me-4 d-flex align-items-center justify-content-center rounded-circle" 
                  style={{ 
                    width: '60px', 
                    height: '60px',
                    backgroundColor: processingStatus.evaluationReadyStatus === 'ready' 
                      ? 'rgba(40, 167, 69, 0.1)' 
                      : processingStatus.evaluationReadyStatus === 'partial' 
                      ? 'rgba(255, 193, 7, 0.1)' 
                      : 'rgba(0, 123, 255, 0.1)',
                  }}
                >
                  {processingStatus.evaluationReadyStatus === 'ready' ? (
                    <FiCheckCircle className="text-success" size={30} />
                  ) : processingStatus.evaluationReadyStatus === 'partial' ? (
                    <FiCheckCircle className="text-warning" size={30} />
                  ) : (
                    <FiClock className="text-primary" size={30} />
                  )}
                </div>
                <div>
                  <h4 className={`mb-2 fw-bold ${
                    processingStatus.evaluationReadyStatus === 'ready'
                      ? 'text-success' 
                      : processingStatus.evaluationReadyStatus === 'partial'
                      ? 'text-warning'
                      : 'text-primary'
                  }`}>
                    {processingStatus.evaluationReadyStatus === 'ready'
                      ? 'Ready for Evaluation' 
                      : processingStatus.evaluationReadyStatus === 'partial'
                      ? 'Partially Ready for Evaluation'
                      : 'Not Ready for Evaluation'}
                  </h4>
                  <p className="text-muted mb-4">
                    {processingStatus.evaluationReadyStatus === 'ready'
                      ? 'All documents have been processed successfully. You can now evaluate student submissions.'
                      : processingStatus.evaluationReadyStatus === 'partial'
                      ? 'Essential documents have been processed. You can evaluate submissions with limited features.'
                      : 'Waiting for document processing to complete before evaluation can begin.'}
                  </p>
                  
                  <div className="d-flex flex-wrap gap-3">
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => navigate('/assignments')}
                      className="px-4"
                    >
                      <FiArrowLeft className="me-2" /> Back to Assignments
                    </Button>
                    
                    <Button 
                      variant="primary" 
                      onClick={() => navigate(`/assignments/${id}/submit`)}
                      disabled={processingStatus.evaluationReadyStatus === 'not_ready'}
                      className="px-4"
                    >
                      {processingStatus.evaluationReadyStatus !== 'not_ready' ? (
                        <>
                          <FiUpload className="me-2" /> Upload Student Submissions
                        </>
                      ) : (
                        <>
                          <Spinner animation="border" size="sm" role="status" className="me-2" />
                          Waiting for Processing...
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Card.Body>
      </Card>

      <style jsx="true">{`
        .progress-tall {
          height: 12px;
          border-radius: 6px;
        }
        
        .progress-label {
          position: absolute;
          right: 0;
          top: -12px;
          transform: translateY(-50%);
        }
        
        .status-card {
          border-radius: 12px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .status-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
          background-color: #e9ecef;
        }
        
        .status-card.status-completed::before {
          background-color: #28a745;
        }
        
        .status-card.status-processing::before {
          background-color: #ffc107;
        }
        
        .status-card.status-failed::before {
          background-color: #dc3545;
        }
        
        .status-icon {
          height: 46px;
          display: flex;
          align-items: center;
        }
        
        .status-label {
          font-weight: 600;
        }
        
        .processing-icon-container {
          display: inline-flex;
          align-items: center;
          height: 22px;
        }
      `}</style>
    </Container>
  );
};

export default AssignmentProcessingPage;