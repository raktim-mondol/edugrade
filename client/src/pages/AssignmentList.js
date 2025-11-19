import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, InputGroup, Form, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { 
  FiPlusCircle, FiUpload, FiBarChart2, FiRefreshCw, FiEdit, FiTrash2, 
  FiCalendar, FiBookOpen, FiSearch, FiFilter, FiChevronRight, FiCheck, 
  FiClock, FiCheckCircle, FiAlertCircle, FiInfo
} from 'react-icons/fi';
import './AssignmentList.css'; // Make sure to create this CSS file

// Add custom CSS for card enhanced visuals with soft solid colors
const cardStyles = {
  ready: {
    background: '#f0f0f0',
    boxShadow: '0 8px 20px rgba(33, 33, 33, 0.15)'
  },
  partial: {
    background: '#fff8e6',
    boxShadow: '0 8px 20px rgba(255, 193, 7, 0.15)'
  },
  not_ready: {
    background: '#f0f7ff',
    boxShadow: '0 8px 20px rgba(13, 110, 253, 0.15)'
  },
  error: {
    background: '#fff2f2',
    boxShadow: '0 8px 20px rgba(220, 53, 69, 0.15)'
  },
  default: {
    background: '#ffffff',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)'
  }
};

const AssignmentList = () => {
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [processingStatuses, setProcessingStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);

  const fetchAssignmentStatuses = async (assignmentList) => {
    const statuses = {};
    await Promise.all(
      assignmentList.map(async (assignment) => {
        try {
          const statusResponse = await api.get(`/api/assignments/${assignment._id}/status`);
          statuses[assignment._id] = statusResponse.data;
        } catch (err) {
          console.error(`Error fetching status for assignment ${assignment._id}:`, err);
          statuses[assignment._id] = { evaluationReadyStatus: 'error' };
        }
      })
    );
    return statuses;
  };

  const fetchAssignments = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data } = await api.get('/api/assignments');
      const assignmentList = data.assignments || [];
      setAssignments(assignmentList);
      
      // Fetch processing status for each assignment
      const statuses = await fetchAssignmentStatuses(assignmentList);
      setProcessingStatuses(statuses);
      setError(null);
      applyFilters(assignmentList, searchQuery, statusFilter, sortBy);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments. Please try again later.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    
    // Set up polling for status updates every 30 seconds
    const intervalId = setInterval(() => {
      if (assignments.length > 0) {
        (async () => {
          try {
            const statuses = await fetchAssignmentStatuses(assignments);
            setProcessingStatuses(statuses);
          } catch (err) {
            console.error('Error polling assignment statuses:', err);
          }
        })();
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
    applyFilters(assignments, searchQuery, statusFilter, sortBy);
  }, [assignments, searchQuery, statusFilter, sortBy]);

  const applyFilters = (assignmentList, query, status, sort) => {
    let filtered = [...assignmentList];
    
    // Apply search filter
    if (query) {
      filtered = filtered.filter(
        assignment => 
          assignment.title.toLowerCase().includes(query.toLowerCase()) ||
          assignment.course.toLowerCase().includes(query.toLowerCase()) ||
          assignment.description.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Apply status filter
    if (status !== 'all') {
      filtered = filtered.filter(
        assignment => processingStatuses[assignment._id]?.evaluationReadyStatus === status
      );
    }
    
    // Apply sorting
    switch (sort) {
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'dueDate':
        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        break;
      case 'course':
        filtered.sort((a, b) => a.course.localeCompare(b.course));
        break;
      case 'createdAt':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default:
        break;
    }
    
    setFilteredAssignments(filtered);
  };

  const deleteAssignment = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment? All associated data including submissions and evaluations will be permanently deleted.')) {
      try {
        setDeleteLoading(id);
        await api.delete(`/api/assignments/${id}`);
        setAssignments(assignments.filter(assignment => assignment._id !== id));
        setDeleteLoading(null);
      } catch (err) {
        console.error('Error deleting assignment:', err);
        setError('Failed to delete assignment. Please try again later.');
        setDeleteLoading(null);
      }
    }
  };

  const getStatusBadge = (assignmentId) => {
    const status = processingStatuses[assignmentId]?.evaluationReadyStatus;
    const orchestrationData = processingStatuses[assignmentId]?.orchestrationData;
    const orchestrationStatus = processingStatuses[assignmentId]?.orchestrationStatus;
    
    if (!status) return null;
    
    const showOrchestrationBadge = orchestrationStatus === 'completed' && orchestrationData;
    
    switch (status) {
      case 'ready':
        return (
          <div className="d-flex flex-column align-items-end gap-1">
            <Badge bg="success" className="d-inline-flex align-items-center px-2 py-1">
              <FiCheckCircle className="me-1" /> Ready
            </Badge>
            {showOrchestrationBadge && (
              <Badge 
                bg={orchestrationData.completenessScore >= 80 ? 'success' : orchestrationData.completenessScore >= 60 ? 'warning' : 'secondary'}
                className="small"
                title="Orchestration completeness score"
              >
                {orchestrationData.completenessScore}% Validated
              </Badge>
            )}
          </div>
        );
      case 'partial':
        return (
          <div className="d-flex flex-column align-items-end gap-1">
            <Badge bg="warning" text="dark" className="d-inline-flex align-items-center px-2 py-1">
              <FiInfo className="me-1" /> Partial
            </Badge>
            {showOrchestrationBadge && (
              <Badge 
                bg={orchestrationData.completenessScore >= 80 ? 'success' : orchestrationData.completenessScore >= 60 ? 'warning' : 'secondary'}
                className="small"
                title="Orchestration completeness score"
              >
                {orchestrationData.completenessScore}% Validated
              </Badge>
            )}
          </div>
        );
      case 'not_ready':
        return (
          <Badge bg="info" className="d-inline-flex align-items-center px-2 py-1">
            <Spinner animation="border" size="sm" role="status" className="me-1" style={{width: '8px', height: '8px'}} />
            Processing
          </Badge>
        );
      case 'error':
        return (
          <Badge bg="danger" className="d-inline-flex align-items-center px-2 py-1">
            <FiAlertCircle className="me-1" /> Error
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusClass = (assignmentId) => {
    const status = processingStatuses[assignmentId]?.evaluationReadyStatus;
    switch (status) {
      case 'ready': return 'border-success';
      case 'partial': return 'border-warning';
      case 'not_ready': return '';
      case 'error': return 'border-danger';
      default: return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if it's today, tomorrow or in the past
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else if (date < today) {
      return 'Past due';
    }
    
    // Otherwise return the date
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDueDateColor = (dateString) => {
    if (!dateString) return 'text-muted';
    
    const date = new Date(dateString);
    const today = new Date();
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    
    if (date < today) {
      return 'text-danger';
    } else if (date <= threeDaysLater) {
      return 'text-warning';
    }
    return 'text-success';
  };

  const refreshAssignments = () => {
    fetchAssignments(true);
  };

  const renderAssignmentCards = () => {
    if (!filteredAssignments.length) {
      return (
        <Col xs={12}>
          <Alert variant="info">
            <FiInfo className="me-2" />
            No assignments found. Create a new assignment to get started.
          </Alert>
        </Col>
      );
    }

    return filteredAssignments.map(assignment => {
      const status = processingStatuses[assignment._id] || { evaluationReadyStatus: 'unknown' };
      const cardStyle = cardStyles[status.evaluationReadyStatus] || cardStyles.default;
      const statusClass = status.evaluationReadyStatus ? `${status.evaluationReadyStatus}-card` : '';

      return (
        <Col key={assignment._id} lg={4} md={6} className="mb-4">
          <Card className={`assignment-card border-0 ${statusClass}`} style={cardStyle}>
            <Card.Body className="d-flex flex-column p-4">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <Card.Title className="fs-5 fw-bold text-truncate pe-2">{assignment.title}</Card.Title>
                {getStatusBadge(assignment._id)}
              </div>
              
              <div className="course-info text-muted small mb-2">
                <span>{assignment.course}</span>
              </div>
              
              <div className={`d-flex align-items-center mb-3 ${getDueDateColor(assignment.dueDate)}`}>
                <span className="due-date-label">
                  <FiCalendar className="me-2" />
                  {formatDate(assignment.dueDate)}
                </span>
                {assignment.totalPoints && (
                  <Badge bg="light" text="dark" className="ms-auto points-badge">
                    {assignment.totalPoints} Points
                  </Badge>
                )}
              </div>

              <div className="description-container text-muted mb-4">
                <p className="mb-0">{assignment.description}</p>
              </div>
              
              <div className="mt-auto pt-3 action-buttons">
                {/* Group for Submit and View Results buttons */}
                <div className="d-flex gap-2">
                  <Button 
                    as={Link}
                    to={`/assignments/${assignment._id}/submit`}
                    className="btn-card-success"
                    size="sm"
                  >
                    <FiUpload className="me-1" /> Submit
                  </Button>
                  
                  <Button 
                    as={Link} 
                    to={`/assignments/${assignment._id}/results`} 
                    className="btn-card-primary"
                    size="sm"
                  >
                    <FiBarChart2 className="me-1" /> View Results
                  </Button>
                </div>
                
                {/* Group for icon buttons */}
                <div className="icon-buttons-container">
                  <Button 
                    as={Link} 
                    to={`/assignments/edit/${assignment._id}`} 
                    className="btn-card-light"
                    title="Edit assignment"
                  >
                    <FiEdit size={18} />
                  </Button>
                  
                  <Button 
                    as={Link}
                    to={`/assignments/${assignment._id}/processing`}
                    className="btn-card-info"
                    title="View processing status"
                  >
                    <FiInfo size={18} />
                  </Button>
                  
                  <Button 
                    className="btn-card-danger"
                    onClick={() => deleteAssignment(assignment._id)}
                    disabled={deleteLoading === assignment._id}
                    title="Delete assignment"
                  >
                    {deleteLoading === assignment._id ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <FiTrash2 size={18} />
                    )}
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      );
    });
  };

  return (
    <Container className="py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="fw-bold mb-0">Assignments</h1>
          <p className="text-muted">Manage your course assignments and evaluations</p>
        </Col>
        <Col xs="auto">
          <div className="d-flex gap-2">
            <Button 
              variant="light" 
              onClick={refreshAssignments}
              disabled={isRefreshing}
              className="d-flex align-items-center justify-content-center"
            >
              {isRefreshing ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : (
                <FiRefreshCw className={`me-2 ${isRefreshing ? 'spin-animation' : ''}`} />
              )}
              Refresh
            </Button>
            
            <Link to="/projects">
              <Button 
                variant="outline-primary" 
                className="d-flex align-items-center"
              >
                <FiBookOpen className="me-2" />
                Projects
              </Button>
            </Link>
            
            <Link to="/assignments/new">
              <Button 
                variant="primary" 
                className="d-flex align-items-center btn-create-assignment"
              >
                <FiPlusCircle className="me-2" />
                Create Assignment
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      {!loading && !error && assignments.length > 0 && (
        <Row className="mb-4">
          <Col md={6} lg={4} className="mb-3 mb-md-0">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <FiSearch className="text-muted" />
              </InputGroup.Text>
              <Form.Control
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </Button>
              )}
            </InputGroup>
          </Col>
          
          <Col md={3} lg={4} className="mb-3 mb-md-0">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <FiFilter className="text-muted" />
              </InputGroup.Text>
              <Form.Select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready</option>
                <option value="partial">Partially Ready</option>
                <option value="not_ready">Processing</option>
                <option value="error">Error</option>
              </Form.Select>
            </InputGroup>
          </Col>
          
          <Col md={3} lg={4}>
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <FiClock className="text-muted" />
              </InputGroup.Text>
              <Form.Select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="dueDate">Sort by Due Date</option>
                <option value="title">Sort by Title</option>
                <option value="course">Sort by Course</option>
                <option value="createdAt">Sort by Created Date</option>
              </Form.Select>
            </InputGroup>
          </Col>
        </Row>
      )}

      {loading && !isRefreshing ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" variant="primary" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="text-muted mt-3">Loading assignments...</p>
        </div>
      ) : error ? (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm">
          <FiAlertCircle className="me-2 flex-shrink-0" size={24} />
          <div>{error}</div>
        </Alert>
      ) : assignments.length === 0 ? (
        <Card className="border-0 shadow-sm p-4">
          <div className="text-center py-5">
            <div className="mb-4">
              <div className="d-inline-flex rounded-circle bg-light p-4">
                <FiBookOpen size={60} className="text-secondary" />
              </div>
            </div>
            <h3>No assignments found</h3>
            <p className="text-muted mb-4">Create your first assignment to get started with grading.</p>
            <Link to="/assignments/new">
              <Button variant="primary" className="rounded-pill">
                <FiPlusCircle className="me-2" />
                Create Your First Assignment
              </Button>
            </Link>
          </div>
        </Card>
      ) : filteredAssignments.length === 0 ? (
        <Card className="border-0 shadow-sm p-4">
          <div className="text-center py-4">
            <div className="d-inline-flex rounded-circle bg-light p-3 mb-3">
              <FiSearch size={40} className="text-secondary" />
            </div>
            <h4>No matching assignments found</h4>
            <p className="text-muted mb-3">Try adjusting your search criteria or filters.</p>
            <Button variant="outline-secondary" onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}>
              Clear Filters
            </Button>
          </div>
        </Card>
      ) : (
        <Row>
          {renderAssignmentCards()}
        </Row>
      )}
    </Container>
  );
};

export default AssignmentList;