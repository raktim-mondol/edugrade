import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { FiPlusCircle, FiCalendar, FiEdit, FiTrash2, FiInfo, FiUpload, FiBarChart2, FiRefreshCw, FiCode, FiFileText } from 'react-icons/fi';
import './AssignmentList.css'; // Reusing the styles from AssignmentList

// Status badge styles
const statusBadgeStyles = {
  ready: { bg: 'success', icon: <FiInfo className="me-1" />, text: 'Ready' },
  partial: { bg: 'warning', icon: <FiInfo className="me-1" />, text: 'Partial' },
  not_ready: { bg: 'secondary', icon: <FiInfo className="me-1" />, text: 'Not Ready' },
  error: { bg: 'danger', icon: <FiInfo className="me-1" />, text: 'Error' }
};

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [processingStatuses, setProcessingStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Modal state for delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Format date helper function
  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  // Get project status badge
  const getStatusBadge = (projectId) => {
    const status = processingStatuses[projectId]?.evaluationReadyStatus || 'not_ready';
    const badgeStyle = statusBadgeStyles[status];
    
    return (
      <Badge bg={badgeStyle.bg} className="ms-2 text-white d-flex align-items-center status-badge">
        {badgeStyle.icon} {badgeStyle.text}
      </Badge>
    );
  };
  
  const fetchProjects = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get('/api/projects');
      setProjects(response.data.projects || []);
      
      // Fetch processing status for each project
      const statuses = {};
      await Promise.all(
        (response.data.projects || []).map(async (project) => {
          try {
            const statusRes = await api.get(`/api/projects/${project._id}/status`);
            statuses[project._id] = statusRes.data;
          } catch (err) {
            console.error(`Error fetching status for project ${project._id}:`, err);
            statuses[project._id] = { evaluationReadyStatus: 'error' };
          }
        })
      );
      
      setProcessingStatuses(statuses);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    
    // Poll for status updates every 30 seconds
    const intervalId = setInterval(async () => {
      if (projects.length > 0) {
        const statuses = {};
        await Promise.all(
          projects.map(async (project) => {
            try {
              const response = await api.get(`/api/projects/${project._id}/status`);
              statuses[project._id] = response.data;
            } catch (err) {
              console.error(`Error fetching status for project ${project._id}:`, err);
            }
          })
        );
        setProcessingStatuses(statuses);
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProjects = () => {
    fetchProjects(true);
  };

  const confirmDeleteProject = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    setDeleteLoading(true);
    try {
      await api.delete(`/api/projects/${projectToDelete._id}`);
      setShowDeleteModal(false);
      // Refresh the project list after successful deletion
      fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderProjectCards = () => {
    if (projects.length === 0) {
      return (
        <Col xs={12}>
          <Alert variant="info">
            <FiInfo className="me-2" />
            No projects found. Create a new project to get started.
          </Alert>
        </Col>
      );
    }

    return projects.map((project) => (
      <Col key={project._id} lg={4} md={6} className="mb-4">
        <Card className="assignment-card border-0">
          <Card.Body className="d-flex flex-column p-4">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <Card.Title className="fs-5 fw-bold text-truncate pe-2">{project.title}</Card.Title>
              {getStatusBadge(project._id)}
            </div>
            
            <div className="course-info text-muted small mb-2">
              <span>{project.course}</span>
            </div>
            
            <div className="d-flex align-items-center mb-3">
              <span className="due-date-label">
                <FiCalendar className="me-2" />
                {formatDate(project.dueDate)}
              </span>
              {project.totalPoints && (
                <Badge bg="light" text="dark" className="ms-auto points-badge">
                  {project.totalPoints} Points
                </Badge>
              )}
            </div>

            <div className="mb-3">
              <div className="d-flex mb-2">
                <div style={{ width: '50%' }}>
                  <Badge bg={project.codeRequired ? 'primary' : 'light'} text={project.codeRequired ? 'white' : 'dark'} className="me-2">
                    <FiCode className="me-1" /> Code {project.codeRequired ? 'Required' : 'Optional'}
                  </Badge>
                </div>
                <div style={{ width: '50%' }}>
                  <Badge bg={project.reportRequired ? 'primary' : 'light'} text={project.reportRequired ? 'white' : 'dark'}>
                    <FiFileText className="me-1" /> Report {project.reportRequired ? 'Required' : 'Optional'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="description-container text-muted mb-4">
              <p className="mb-0">{project.description}</p>
            </div>
            
            <div className="mt-auto pt-3 action-buttons">
              {/* Group for Submit and View Results buttons */}
              <div className="d-flex gap-2">
                <Button 
                  as={Link}
                  to={`/projects/${project._id}/submit`}
                  className="btn-card-success"
                  size="sm"
                >
                  <FiUpload className="me-1" /> Submit
                </Button>
                
                <Button 
                  as={Link} 
                  to={`/projects/${project._id}/results`} 
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
                  to={`/projects/edit/${project._id}`} 
                  className="btn-card-light"
                  title="Edit project"
                >
                  <FiEdit size={18} />
                </Button>
                
                <Button 
                  as={Link}
                  to={`/projects/${project._id}/processing`}
                  className="btn-card-info"
                  title="View processing status"
                >
                  <FiInfo size={18} />
                </Button>
                
                <Button 
                  className="btn-card-danger"
                  onClick={() => confirmDeleteProject(project)}
                  title="Delete project"
                >
                  <FiTrash2 size={18} />
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>
    ));
  };

  return (
    <Container className="py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="fw-bold mb-0">Projects</h1>
          <p className="text-muted">Manage your group projects with code and report evaluation</p>
        </Col>
        <Col xs="auto">
          <div className="d-flex gap-2">
            <Button 
              variant="light" 
              onClick={refreshProjects}
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
            
            <Link to="/">
              <Button 
                variant="outline-primary" 
                className="d-flex align-items-center"
              >
                <FiCalendar className="me-2" />
                Assignments
              </Button>
            </Link>
            
            <Link to="/projects/new">
              <Button 
                variant="primary" 
                className="d-flex align-items-center"
              >
                <FiPlusCircle className="me-2" />
                Create Project
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      {loading && !isRefreshing ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" variant="primary" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="text-muted mt-3">Loading projects...</p>
        </div>
      ) : error ? (
        <Alert variant="danger" className="d-flex align-items-center">
          <FiInfo className="me-2 flex-shrink-0" size={24} />
          <div>{error}</div>
        </Alert>
      ) : (
        <Row>
          {renderProjectCards()}
        </Row>
      )}

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the project <strong>{projectToDelete?.title}</strong>? 
          <br /><br />
          This will permanently delete all associated submissions and evaluations.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteProject}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>Delete Project</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProjectList;