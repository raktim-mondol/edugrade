import React, { useState, useEffect, useRef, useReducer } from 'react';
import { Container, Row, Col, Card, Button, Table, Spinner, Alert, Badge, Modal, Form, Nav, Tab } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import fileDownload from 'js-file-download';
import { FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiClock, FiTrash2, FiSearch, FiBarChart2, FiFilter, FiArrowLeft, FiUsers, FiInfo, FiUpload } from 'react-icons/fi';

// Add DELETE_SUBMISSION action to the reducer
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
    case 'DELETE_SUBMISSION': {
      // Remove the submission with the given ID
      return state.filter(sub => sub._id !== action.id);
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

const ResultsPage = () => {
  const { id: assignmentId } = useParams();
  const navigate = useNavigate();
  
  const [assignment, setAssignment] = useState(null);
  const [submissions, dispatchSubmissions] = useReducer(submissionsReducer, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [updatingSubmissionIds, setUpdatingSubmissionIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Sorting state - default to sort by submission time (newest first)
  const [sortField, setSortField] = useState('submitDate');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // References
  const pollingIntervalRef = useRef(null);
  const timeoutsRef = useRef({});
  
  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch assignment details
        const assignmentRes = await axios.get(`/api/assignments/${assignmentId}`);
        // Handle potential nested response structure
        const assignmentData = assignmentRes.data.assignment || assignmentRes.data;
        setAssignment(assignmentData);
        
        // Fetch submissions for this assignment
        const submissionsRes = await axios.get(`/api/submissions/${assignmentId}`);
        // Handle potential nested response structure
        const submissionsData = submissionsRes.data.submissions || submissionsRes.data || [];
        
        // Make sure we have an array to work with
        const submissionsArray = Array.isArray(submissionsData) ? submissionsData : [];
        
        // Normalize the status fields and scores for each submission
        const normalizedSubmissions = submissionsArray.map(submission => {
          // Fix status field inconsistency by checking evaluationStatus
          let status;
          if (submission.evaluationStatus === 'completed') {
            status = 'completed';
          } else if (submission.evaluationStatus === 'failed') {
            status = 'failed';
          } else if (submission.evaluationStatus === 'pending' && submission.processingStatus === 'completed') {
            status = 'evaluating';
          } else {
            status = submission.processingStatus || 'pending';
          }
          
          // Make sure score field is populated from overallGrade if available
          let score = submission.score;
          if (submission.evaluationStatus === 'completed' && submission.overallGrade !== undefined) {
            score = submission.overallGrade;
          }
          
          return {
            ...submission,
            status,
            score
          };
        });
        
        dispatchSubmissions({ type: 'INITIALIZE', submissions: normalizedSubmissions });
        setLastUpdated(new Date());
                
        // Check if any submissions are still being evaluated
        const evaluatingSubmissions = normalizedSubmissions.filter(
          sub => sub.status === 'evaluating' || sub.status === 'pending'
        );
        
        if (evaluatingSubmissions.length > 0) {
          setPollingActive(true);
          setUpdatingSubmissionIds(evaluatingSubmissions.map(sub => sub._id));
        } else {
          setPollingActive(false);
          setUpdatingSubmissionIds([]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching results data:', err);
        setError('Failed to load results. Please try again.');
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
      
      // Store the current timeouts reference to avoid the React hooks warning
      const timeouts = timeoutsRef.current;
      // Clear all highlight timeouts
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
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
            .then(res => {
              // Extract submission from response and normalize status fields
              const submission = res.data.submission || res.data;
              
              // Fix status field inconsistency by checking evaluationStatus
              if (submission.evaluationStatus === 'completed') {
                submission.status = 'completed';
              } else if (submission.evaluationStatus === 'failed') {
                submission.status = 'failed';
              } else if (submission.evaluationStatus === 'pending' && submission.processingStatus === 'completed') {
                submission.status = 'evaluating';
              } else {
                submission.status = submission.processingStatus;
              }
              
              // Make sure score field is set from overallGrade if available
              if (submission.evaluationStatus === 'completed' && submission.overallGrade !== undefined) {
                submission.score = submission.overallGrade;
              }
              
              return submission;
            })
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
          
          // Update the time of last update
          setLastUpdated(new Date());
          
          // Check if we still have any evaluating submissions
          const stillEvaluating = validUpdates
            .filter(sub => sub.status === 'evaluating' || sub.status === 'pending')
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
  }, [pollingActive, updatingSubmissionIds, submissions]);
  
  // Manually refresh all data
  const refreshAllData = async () => {
    try {
      const submissionsRes = await axios.get(`/api/submissions/${assignmentId}`);
      
      // Handle potential nested response structure
      const submissionsData = submissionsRes.data.submissions || submissionsRes.data || [];
      
      // Make sure we have an array to work with
      const submissionsArray = Array.isArray(submissionsData) ? submissionsData : [];
      
      // Normalize the status fields and scores for each submission
      const normalizedSubmissions = submissionsArray.map(submission => {
        // Fix status field inconsistency by checking evaluationStatus
        let status;
        if (submission.evaluationStatus === 'completed') {
          status = 'completed';
        } else if (submission.evaluationStatus === 'failed') {
          status = 'failed';
        } else if (submission.evaluationStatus === 'pending' && submission.processingStatus === 'completed') {
          status = 'evaluating';
        } else {
          status = submission.processingStatus || 'pending';
        }
        
        // Make sure score field is populated from overallGrade if available
        let score = submission.score;
        if (submission.evaluationStatus === 'completed' && submission.overallGrade !== undefined) {
          score = submission.overallGrade;
        }
        
        return {
          ...submission,
          status,
          score
        };
      });
      
      dispatchSubmissions({ type: 'INITIALIZE', submissions: normalizedSubmissions });
      setLastUpdated(new Date());
      
      // Check if any submissions are still being evaluated
      const evaluatingSubmissions = normalizedSubmissions.filter(
        sub => sub.status === 'evaluating' || sub.status === 'pending'
      );
      
      setPollingActive(evaluatingSubmissions.length > 0);
      setUpdatingSubmissionIds(evaluatingSubmissions.map(sub => sub._id));
      
      return true;
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data. Please try again.');
      return false;
    }
  };
  
  // Download Excel file with results
  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      const response = await axios.get(`/api/submissions/${assignmentId}/export`, {
        responseType: 'blob'
      });
      
      // Generate filename based on assignment title
      const filename = assignment?.title 
        ? `${assignment.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}_results.xlsx` 
        : 'evaluation-results.xlsx';
      
      fileDownload(response.data, filename);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Failed to export results to Excel. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  // Handle delete button click to open the confirmation modal
  const handleDeleteClick = (submission) => {
    setSubmissionToDelete(submission);
    setShowDeleteModal(true);
  };
  
  // Handle delete confirmation and delete the submission
  const handleDeleteConfirm = async () => {
    if (!submissionToDelete) return;
    
    setDeleting(true);
    try {
      console.log(`Attempting to delete submission with ID: ${submissionToDelete._id}`);
      
      // Make sure the ID is a valid MongoDB ID and properly formatted
      const submissionId = submissionToDelete._id.toString();
      
      // Use the relative URL to work with the configured proxy
      const endpoint = `/api/submissions/${submissionId}`;
      console.log(`DELETE request to endpoint: ${endpoint}`);
      
      const response = await axios.delete(endpoint);
      console.log('Delete response:', response);
      
      if (response && response.status === 200) {
        // Update state to remove the submission
        dispatchSubmissions({
          type: 'DELETE_SUBMISSION',
          id: submissionToDelete._id
        });
        
        setShowDeleteModal(false);
        setSubmissionToDelete(null);
        setLastUpdated(new Date());
        setError(null); // Clear any previous errors
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      console.error('Error details:', error.response || error);
      
      // Show a more specific error message to help debug
      let errorMessage = 'Failed to delete submission';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage += ': Submission not found';
        } else if (error.response.data && error.response.data.error) {
          errorMessage += `: ${error.response.data.error}`;
        } else {
          errorMessage += `: Server error (${error.response.status})`;
        }
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };
  
  // Get status badge for submission
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge bg="success" className="d-flex align-items-center gap-1 py-2 px-3"><FiCheckCircle size={14} /> Completed</Badge>;
      case 'failed':
        return <Badge bg="danger" className="d-flex align-items-center gap-1 py-2 px-3"><FiAlertCircle size={14} /> Failed</Badge>;
      case 'evaluating':
        return <Badge bg="warning" text="dark" className="d-flex align-items-center gap-1 py-2 px-3"><FiClock size={14} /> Evaluating</Badge>;
      default:
        return <Badge bg="secondary" className="d-flex align-items-center gap-1 py-2 px-3"><FiClock size={14} /> Pending</Badge>;
    }
  };
  
  // Format score to show points earned out of total possible
  const formatScore = (submission) => {
    if (submission.status !== 'completed') {
      return submission.status === 'evaluating' ? 
        <span className="text-muted d-flex align-items-center"><FiClock className="spin-animation me-1" size={14} /> Calculating...</span> : 
        '-';
    }
    
    const scoreValue = submission.totalPossible ? 
      `${submission.score} / ${submission.totalPossible}` : 
      `${submission.score}`;
      
    return <span className="fw-bold">{scoreValue}</span>;
  };
  
  // Handle column sorting
  const handleSort = (field) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as the sort field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Get sort icon for the column header
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };
  
  // Calculate statistical metrics for display
  const completedSubmissions = submissions.filter(sub => sub.status === 'completed');
  
  // Calculate metrics only if we have completed submissions
  let scoreStats = {
    median: 0,
    stdDev: 0,
    min: 0,
    max: 0,
    avg: 0
  };
  
  if (completedSubmissions.length > 0) {
    // Extract scores from completed submissions
    const scores = completedSubmissions.map(sub => Number(sub.score) || 0);
    
    // Sort scores for median and min/max
    const sortedScores = [...scores].sort((a, b) => a - b);
    
    // Calculate median
    const mid = Math.floor(sortedScores.length / 2);
    scoreStats.median = sortedScores.length % 2 === 0
      ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
      : sortedScores[mid];
    
    // Calculate mean (needed for std deviation)
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    scoreStats.avg = mean;
    
    // Calculate standard deviation
    const squaredDifferences = scores.map(score => Math.pow(score - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / scores.length;
    scoreStats.stdDev = Math.sqrt(variance);
    
    // Min and Max
    scoreStats.min = sortedScores[0];
    scoreStats.max = sortedScores[sortedScores.length - 1];
  }
  
  // Filter submissions based on search term and active tab
  const filteredSubmissions = [...submissions].filter(sub => {
    // First apply tab filter
    if (activeTab === 'completed' && sub.status !== 'completed') return false;
    if (activeTab === 'pending' && (sub.status !== 'evaluating' && sub.status !== 'pending')) return false;
    if (activeTab === 'failed' && sub.status !== 'failed') return false;
    
    // Then apply search filter if there's a search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return sub.studentId?.toLowerCase().includes(term) ||
        sub.studentName?.toLowerCase().includes(term);
    }
    return true;
  });
  
  // Sort the filtered submissions based on current sort field and direction
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    // Helper function to safely compare values that might be null/undefined
    const safeCompare = (valA, valB, defaultVal = 0) => {
      if (valA === undefined || valA === null) return defaultVal;
      if (valB === undefined || valB === null) return -defaultVal;
      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    };
    
    // Compare based on the selected sort field
    let result = 0;
    
    switch (sortField) {
      case 'studentId':
        result = safeCompare(a.studentId?.toLowerCase(), b.studentId?.toLowerCase());
        break;
      case 'status':
        result = safeCompare(a.status, b.status);
        break;
      case 'score':
        // For score, only compare if both submissions are completed
        if (a.status === 'completed' && b.status === 'completed') {
          const scoreA = Number(a.score) || 0;
          const scoreB = Number(b.score) || 0;
          result = safeCompare(scoreA, scoreB);
        } else if (a.status === 'completed') {
          result = -1; // Completed submissions first
        } else if (b.status === 'completed') {
          result = 1;
        } else {
          result = safeCompare(a.status, b.status); // Sort by status for non-completed
        }
        break;
      case 'submitDate':
        // Convert dates to timestamps for comparison
        const dateA = a.submitDate ? new Date(a.submitDate).getTime() : 0;
        const dateB = b.submitDate ? new Date(b.submitDate).getTime() : 0;
        result = safeCompare(dateA, dateB);
        break;
      case 'evaluatedDate':
        // Convert dates to timestamps for comparison
        const evalA = a.evaluationCompletedAt ? new Date(a.evaluationCompletedAt).getTime() : 0;
        const evalB = b.evaluationCompletedAt ? new Date(b.evaluationCompletedAt).getTime() : 0;
        result = safeCompare(evalA, evalB);
        break;
      default:
        result = 0;
    }
    
    // Apply sort direction
    return sortDirection === 'asc' ? result : -result;
  });
  
  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" role="status" variant="primary" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3 text-muted">Loading evaluation results...</p>
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
            <h2 className="mb-0 fw-bold">Evaluation Results</h2>
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
          <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary"
              onClick={refreshAllData}
              disabled={loading || pollingActive}
              className="d-flex align-items-center"
            >
              <FiRefreshCw className={pollingActive ? "spin-animation me-2" : "me-2"} /> 
              {pollingActive ? 'Updating...' : 'Refresh'}
            </Button>
            <Button 
              variant="outline-primary"
              onClick={() => navigate(`/assignments/${assignmentId}/submit`)}
              disabled={loading}
              className="d-flex align-items-center"
            >
              <FiUpload className="me-2" /> 
              Upload Submission
            </Button>
            <Button 
              variant="primary"
              onClick={handleExportToExcel}
              disabled={exporting || submissions.length === 0}
              className="d-flex align-items-center"
            >
              <FiDownload className="me-2" /> 
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </Button>
          </div>
        </Col>
      </Row>
      
      {error && (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm border-0">
          <FiAlertCircle size={24} className="me-3 flex-shrink-0" />
          <div>{error}</div>
        </Alert>
      )}
      
      {completedSubmissions.length > 0 && (
        <Row className="mb-4 g-4">
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
                <div className="rounded-circle bg-success bg-opacity-10 p-3 mb-3">
                  <FiUsers size={28} className="text-success" />
                </div>
                <h6 className="text-muted mb-1">Submissions</h6>
                <h3 className="fw-bold mb-0">{completedSubmissions.length}</h3>
                <p className="text-muted small mb-0">completed evaluations</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
                <div className="rounded-circle bg-primary bg-opacity-10 p-3 mb-3">
                  <FiBarChart2 size={28} className="text-primary" />
                </div>
                <h6 className="text-muted mb-1">Average Score</h6>
                <h3 className="fw-bold mb-0">{scoreStats.avg.toFixed(1)}</h3>
                <p className="text-muted small mb-0">out of {assignment?.totalPoints || 100}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
                <div className="rounded-circle bg-warning bg-opacity-10 p-3 mb-3">
                  <FiInfo size={28} className="text-warning" />
                </div>
                <h6 className="text-muted mb-1">Min / Max</h6>
                <h3 className="fw-bold mb-0">{scoreStats.min.toFixed(1)} / {scoreStats.max.toFixed(1)}</h3>
                <p className="text-muted small mb-0">lowest & highest scores</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
                <div className="rounded-circle bg-info bg-opacity-10 p-3 mb-3">
                  <FiBarChart2 size={28} className="text-info" />
                </div>
                <h6 className="text-muted mb-1">Std Deviation</h6>
                <h3 className="fw-bold mb-0">{scoreStats.stdDev.toFixed(2)}</h3>
                <p className="text-muted small mb-0">score distribution</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      
      {!submissions || submissions.length === 0 ? (
        <Card className="border-0 shadow-sm p-4">
          <div className="text-center py-5">
            <div className="mb-4">
              <div className="d-inline-flex rounded-circle bg-light p-4">
                <FiUsers size={60} className="text-secondary" />
              </div>
            </div>
            <h3>No submissions found</h3>
            <p className="text-muted mb-4">There are no student submissions for this assignment yet.</p>
            <Button 
              variant="primary" 
              className="rounded-pill"
              onClick={() => navigate(`/assignments/${assignmentId}/submit`)}
            >
              Upload Student Submissions
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white py-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h5 className="mb-0 fw-bold">Submission Results</h5>
                </div>
                <div className="d-flex gap-3 align-items-center">
                  <Form.Group className="mb-0 d-flex align-items-center position-relative">
                    <FiSearch className="position-absolute ms-3 text-muted" size={16} />
                    <Form.Control
                      type="text"
                      placeholder="Search submissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="ps-5 rounded-pill"
                    />
                  </Form.Group>
                  
                  <div className="d-flex align-items-center">
                    <FiFilter className="me-2 text-muted" size={16} />
                    <span className="text-muted me-2 d-none d-md-inline">Filter:</span>
                  </div>
                  
                  <Nav variant="pills" className="flex-nowrap" activeKey={activeTab} onSelect={(key) => setActiveTab(key)}>
                    <Nav.Item>
                      <Nav.Link eventKey="all" className="py-1 px-2">
                        All ({submissions.length})
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="completed" className="py-1 px-2">
                        Completed ({submissions.filter(s => s.status === 'completed').length})
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="pending" className="py-1 px-2">
                        Pending ({submissions.filter(s => s.status === 'evaluating' || s.status === 'pending').length})
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="failed" className="py-1 px-2">
                        Failed ({submissions.filter(s => s.status === 'failed').length})
                      </Nav.Link>
                    </Nav.Item>
                  </Nav>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="results-table mb-0">
                  <thead>
                    <tr>
                      <th 
                        onClick={() => handleSort('studentId')}
                        style={{ cursor: 'pointer' }}
                        className="user-select-none"
                      >
                        <div className="d-flex align-items-center">
                          Student ID {getSortIcon('studentId')}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('status')}
                        style={{ cursor: 'pointer' }}
                        className="user-select-none"
                      >
                        <div className="d-flex align-items-center">
                          Status {getSortIcon('status')}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('score')}
                        style={{ cursor: 'pointer' }}
                        className="user-select-none"
                      >
                        <div className="d-flex align-items-center">
                          Score {getSortIcon('score')}
                        </div>
                      </th>
                      <th>Feedback</th>
                      <th 
                        onClick={() => handleSort('submitDate')}
                        style={{ cursor: 'pointer' }}
                        className="user-select-none"
                      >
                        <div className="d-flex align-items-center">
                          Submitted {getSortIcon('submitDate')}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('evaluatedDate')}
                        style={{ cursor: 'pointer' }}
                        className="user-select-none"
                      >
                        <div className="d-flex align-items-center">
                          Evaluated {getSortIcon('evaluatedDate')}
                        </div>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubmissions.length > 0 ? (
                      sortedSubmissions.map((submission) => (
                        <tr 
                          key={submission._id}
                          className={submission.justUpdated ? 'highlight-updated-row' : ''}
                          style={updatingSubmissionIds.includes(submission._id) ? 
                            { backgroundColor: 'rgba(255, 250, 205, 0.4)' } : {}
                          }
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="fw-bold">{submission.studentId}</div>
                              {submission.studentName && (
                                <span className="text-muted ms-2">({submission.studentName})</span>
                              )}
                            </div>
                          </td>
                          <td>{getStatusBadge(submission.status)}</td>
                          <td className={submission.justUpdated ? 'highlight-score-cell' : ''}>
                            {formatScore(submission)}
                          </td>
                          <td>
                            {submission.evaluationStatus === 'completed' && submission.evaluationResult ? (
                              <div className="small">
                                {submission.evaluationResult.strengths && submission.evaluationResult.strengths.length > 0 && (
                                  <div className="mb-1">
                                    <Badge bg="success" className="me-1 opacity-75">Strength</Badge> {submission.evaluationResult.strengths[0]}
                                  </div>
                                )}
                                {submission.evaluationResult.areasForImprovement && submission.evaluationResult.areasForImprovement.length > 0 && (
                                  <div>
                                    <Badge bg="warning" text="dark" className="me-1 opacity-75">Improve</Badge> {submission.evaluationResult.areasForImprovement[0]}
                                  </div>
                                )}
                              </div>
                            ) : '-'
                            }
                          </td>
                          <td>
                            {submission.submitDate ? (
                              <div className="small">
                                <div>{new Date(submission.submitDate).toLocaleDateString()}</div>
                                <div className="text-muted">{new Date(submission.submitDate).toLocaleTimeString()}</div>
                              </div>
                            ) : '-'}
                          </td>
                          <td>
                            {submission.evaluationCompletedAt ? (
                              <div className="small">
                                <div>{new Date(submission.evaluationCompletedAt).toLocaleDateString()}</div>
                                <div className="text-muted">{new Date(submission.evaluationCompletedAt).toLocaleTimeString()}</div>
                              </div>
                            ) : '-'}
                          </td>
                          <td>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              className="rounded-circle"
                              onClick={() => handleDeleteClick(submission)}
                            >
                              <FiTrash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <p className="mb-0 text-muted">No submissions match your search criteria</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="fw-bold">Delete Submission</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-4">
            <div className="d-inline-flex justify-content-center align-items-center bg-danger bg-opacity-10 rounded-circle p-3 mb-3">
              <FiTrash2 size={32} className="text-danger" />
            </div>
            <h5>Are you sure you want to delete this submission?</h5>
            <p className="mb-0">Student ID: <strong>{submissionToDelete?.studentId}</strong></p>
            {submissionToDelete?.studentName && (
              <p>Student Name: <strong>{submissionToDelete.studentName}</strong></p>
            )}
          </div>
          <Alert variant="warning" className="d-flex">
            <FiInfo className="mt-1 me-2 flex-shrink-0" />
            <div>This action cannot be undone. The submission will be permanently removed.</div>
          </Alert>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Spinner size="sm" className="me-2" animation="border" />
                Deleting...
              </>
            ) : 'Delete Submission'}
          </Button>
        </Modal.Footer>
      </Modal>
      
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
        
        .results-table th {
          background-color: #f8f9fa;
          font-weight: 600;
          padding: 15px;
        }
        
        .results-table td {
          padding: 15px;
          vertical-align: middle;
        }
        
        @keyframes highlight-fade {
          0% {
            background-color: rgba(76, 175, 80, 0.15);
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
        
        /* Style adjustments for filters */
        .nav-pills .nav-link {
          color: #6c757d;
          border-radius: 30px;
          font-size: 0.9rem;
          transition: all 0.2s;
          position: relative;
        }
        
        .nav-pills .nav-link.active {
          background-color: #4285F4;
          color: white !important; /* Ensure text is white when selected */
          font-weight: 600;
          box-shadow: 0 2px 5px rgba(66, 133, 244, 0.3);
        }
      `}</style>
    </Container>
  );
};

export default ResultsPage;