import React, { useState, useEffect, useRef, useReducer } from 'react';
import { Container, Row, Col, Card, Button, Table, Spinner, Alert, Badge } from 'react-bootstrap';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiUpload, FiDownload, FiBarChart2, FiCheckCircle, FiAlertCircle, FiClock, FiRefreshCw } from 'react-icons/fi';

// Reducer function to handle surgical updates to submission state
const submissionsReducer = (state, action) => {
  switch (action.type) {
    case 'INITIALIZE':
      return action.submissions;
    case 'UPDATE_SINGLE': {
      // Find the submission to update by ID
      const index = state.findIndex(sub => sub._id === action.submission._id);
      if (index === -1) return state;
      
      // Create a new array where only the specific submission is updated
      return state.map((sub, i) => {
        if (i === index) {
          return {
            ...action.submission,
            justUpdated: action.submission.status !== sub.status || 
                        action.submission.score !== sub.score
          };
        }
        return sub;
      });
    }
    case 'CLEAR_HIGHLIGHT': {
      // Remove highlight from a specific submission
      return state.map(sub => {
        if (sub._id === action.id) {
          return { ...sub, justUpdated: false };
        }
        return sub;
      });
    }
    default:
      return state;
  }
};

const SubmissionList = () => {
  const { id: assignmentId } = useParams();
  const navigate = useNavigate();
  
  const [assignment, setAssignment] = useState(null);
  const [submissions, dispatchSubmissions] = useReducer(submissionsReducer, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [updatingSubmissionIds, setUpdatingSubmissionIds] = useState([]);
  
  // References
  const pollingIntervalRef = useRef(null);
  const timeoutsRef = useRef({});
  
  // Initial data loading
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch assignment details
        const assignmentRes = await axios.get(`/api/assignments/${assignmentId}`);
        setAssignment(assignmentRes.data);
        
        // Fetch submissions for this assignment
        const submissionsRes = await axios.get(`/api/submissions/${assignmentId}`);
        dispatchSubmissions({ type: 'INITIALIZE', submissions: submissionsRes.data });
        setLastUpdated(new Date());
        
        // Check if any submissions are still being evaluated
        const hasEvaluating = submissionsRes.data.some(sub => sub.status === 'evaluating');
        setPollingActive(hasEvaluating);
        
        if (hasEvaluating) {
          // Get the IDs of submissions that are in "evaluating" state
          const evaluatingIds = submissionsRes.data
            .filter(sub => sub.status === 'evaluating')
            .map(sub => sub._id);
          setUpdatingSubmissionIds(evaluatingIds);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
        setPollingActive(false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
    
    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Clear all highlight timeouts
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [assignmentId]);
  
  // Setup polling for individual submissions that are being evaluated
  useEffect(() => {
    if (!pollingActive) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }
    
    if (updatingSubmissionIds.length === 0) {
      setPollingActive(false);
      return;
    }
    
    // Function to check for updates to specific submissions
    const fetchUpdates = async () => {
      try {
        // Fetch only the submissions that are being evaluated
        const promises = updatingSubmissionIds.map(subId => 
          axios.get(`/api/submissions/single/${subId}`)
            .then(res => res.data)
            .catch(err => {
              console.error(`Error fetching submission ${subId}:`, err);
              return null;
            })
        );
        
        const updatedSubmissions = await Promise.all(promises);
        const validUpdates = updatedSubmissions.filter(Boolean);
        
        if (validUpdates.length > 0) {
          // Update each submission individually
          validUpdates.forEach(updatedSub => {
            // Update the specific submission in state
            dispatchSubmissions({ 
              type: 'UPDATE_SINGLE', 
              submission: updatedSub 
            });
            
            // Set timeout to clear highlight
            if (timeoutsRef.current[updatedSub._id]) {
              clearTimeout(timeoutsRef.current[updatedSub._id]);
            }
            
            timeoutsRef.current[updatedSub._id] = setTimeout(() => {
              dispatchSubmissions({ 
                type: 'CLEAR_HIGHLIGHT',
                id: updatedSub._id
              });
              delete timeoutsRef.current[updatedSub._id];
            }, 2000);
          });
          
          setLastUpdated(new Date());
          
          // Check if we still have any evaluating submissions
          const stillEvaluating = validUpdates
            .filter(sub => sub.status === 'evaluating')
            .map(sub => sub._id);
            
          if (stillEvaluating.length === 0) {
            // If no more evaluating submissions, stop polling
            setPollingActive(false);
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setUpdatingSubmissionIds([]);
          } else {
            // Update the list of submissions still being evaluated
            setUpdatingSubmissionIds(stillEvaluating);
          }
        }
      } catch (err) {
        console.error('Error fetching updates:', err);
      }
    };
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Set up polling interval - check every 2 seconds
    pollingIntervalRef.current = setInterval(fetchUpdates, 2000);
    
    // Run once immediately
    fetchUpdates();
    
    // Cleanup on unmount or when polling stops
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollingActive, updatingSubmissionIds]);
  
  // Manually fetch updates for all submissions
  const refreshAllSubmissions = async () => {
    try {
      const submissionsRes = await axios.get(`/api/submissions/${assignmentId}`);
      dispatchSubmissions({ type: 'INITIALIZE', submissions: submissionsRes.data });
      setLastUpdated(new Date());
      
      // Check if any submissions are still being evaluated
      const hasEvaluating = submissionsRes.data.some(sub => sub.status === 'evaluating');
      setPollingActive(hasEvaluating);
      
      if (hasEvaluating) {
        const evaluatingIds = submissionsRes.data
          .filter(sub => sub.status === 'evaluating')
          .map(sub => sub._id);
        setUpdatingSubmissionIds(evaluatingIds);
      } else {
        setUpdatingSubmissionIds([]);
      }
      
      return true;
    } catch (err) {
      console.error('Error refreshing submissions:', err);
      return false;
    }
  };
  
  // Get status badge for submission
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge bg="success"><FiCheckCircle className="me-1" /> Completed</Badge>;
      case 'failed':
        return <Badge bg="danger"><FiAlertCircle className="me-1" /> Failed</Badge>;
      case 'evaluating':
        return <Badge bg="warning" text="dark"><FiClock className="me-1" /> Evaluating</Badge>;
      default:
        return <Badge bg="secondary"><FiClock className="me-1" /> Pending</Badge>;
    }
  };
  
  if (loading) {
    return (
      <Container>
        <div className="text-center py-5">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }
  
  return (
    <Container>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2>Submissions</h2>
          {assignment && (
            <p className="text-muted">
              Assignment: {assignment.title}
              {assignment.totalPoints && (
                <Badge bg="info" className="ms-2">
                  Total Points: {assignment.totalPoints}
                </Badge>
              )}
              {lastUpdated && (
                <small className="d-block text-muted">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                  {pollingActive && (
                    <span className="ms-2 badge bg-info text-white">
                      <FiRefreshCw className="spin-animation me-1" /> Auto-updating scores
                    </span>
                  )}
                </small>
              )}
            </p>
          )}
        </Col>
        <Col xs="auto">
          <Button 
            variant="outline-secondary"
            onClick={refreshAllSubmissions}
            className="me-2"
            disabled={pollingActive}
          >
            <FiRefreshCw className="me-1" /> 
            Refresh
          </Button>
          <Button 
            variant="primary"
            onClick={() => navigate(`/assignments/${assignmentId}/submit`)}
            className="me-2"
          >
            <FiUpload className="me-1" /> Upload Submission
          </Button>
          <Button 
            variant="success"
            onClick={() => navigate(`/assignments/${assignmentId}/results`)}
          >
            <FiBarChart2 className="me-1" /> View Results
          </Button>
        </Col>
      </Row>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {submissions.length === 0 ? (
        <Alert variant="info">
          No submissions found for this assignment. 
          <Link to={`/assignments/${assignmentId}/submit`} className="alert-link ms-1">
            Upload submissions
          </Link> to get started.
        </Alert>
      ) : (
        <Card>
          <Card.Header>Submission List</Card.Header>
          <Card.Body style={{ padding: 0 }}>
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr 
                      key={submission._id}
                      className={submission.justUpdated ? 'highlight-updated-row' : ''}
                      style={updatingSubmissionIds.includes(submission._id) ? 
                        { backgroundColor: 'rgba(255, 250, 205, 0.4)' } : {}
                      }
                    >
                      <td><strong>{submission.studentId}</strong></td>
                      <td>{getStatusBadge(submission.status)}</td>
                      <td className={submission.justUpdated ? 'highlight-score-cell' : ''}>
                        {submission.status === 'completed' 
                          ? (submission.totalPossible 
                             ? `${submission.score} / ${submission.totalPossible}` 
                             : submission.score)
                          : submission.status === 'evaluating'
                            ? <small className="text-muted"><FiClock className="spin-animation me-1" /> Calculating...</small>
                            : '-'
                        }
                      </td>
                      <td>{new Date(submission.submittedAt).toLocaleString()}</td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => navigate(`/submissions/${submission._id}/view`)}
                        >
                          <FiBarChart2 /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
          <Card.Footer>
            <div className="d-flex justify-content-between align-items-center">
              <span>Total Submissions: {submissions.length}</span>
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => navigate(`/assignments/${assignmentId}/results`)}
              >
                <FiDownload className="me-1" /> Export All Results
              </Button>
            </div>
          </Card.Footer>
        </Card>
      )}
      
      {/* Add CSS for highlighting updated elements */}
      <style jsx="true">{`
        .highlight-updated-row {
          animation: highlight-fade 2s;
        }
        
        .highlight-score-cell {
          position: relative;
          animation: score-pulse 2s;
          font-weight: bold;
        }
        
        @keyframes highlight-fade {
          0% {
            background-color: rgba(76, 175, 80, 0.3);
          }
          100% {
            background-color: transparent;
          }
        }
        
        @keyframes score-pulse {
          0% {
            color: #28a745;
            transform: scale(1.1);
          }
          100% {
            color: inherit;
            transform: scale(1);
          }
        }
        
        .spin-animation {
          animation: spin 1s infinite linear;
          display: inline-block;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default SubmissionList;