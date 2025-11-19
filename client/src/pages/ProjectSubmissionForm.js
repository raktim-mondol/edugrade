import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Alert, Card } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import FileDropzone from '../components/FileDropzone';
import { FiSend, FiXCircle, FiInfo, FiCode, FiFileText } from 'react-icons/fi';

const ProjectSubmissionForm = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [projectData, setProjectData] = useState(null);
  const [codeFile, setCodeFile] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Fetch project data when component mounts
  useEffect(() => {
    const fetchProject = async () => {
      try {
        // Validate projectId before making the request
        if (!projectId) {
          setError('Invalid project ID. Please check the URL and try again.');
          setFormLoading(false);
          return;
        }
        
        setFormLoading(true);
        const response = await api.get(`/api/projects/${projectId}`);
        setProjectData(response.data.project);
        setError(null);
      } catch (err) {
        console.error('Error fetching project data:', err);
        setError('Failed to load project details. Please try again.');
      } finally {
        setFormLoading(false);
      }
    };
    
    fetchProject();
  }, [projectId]);
  
  const handleCodeFileDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setCodeFile(acceptedFiles[0]);
    }
  };
  
  const handleReportFileDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setReportFile(acceptedFiles[0]);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    // Validation - first check if projectId exists
    if (!projectId) {
      setError('Invalid project ID. Please check the URL and try again.');
      setLoading(false);
      return;
    }
    
    // Additional validations
    if (projectData?.codeRequired && !codeFile) {
      setError('Code file is required for this project.');
      setLoading(false);
      return;
    }
    
    if (projectData?.reportRequired && !reportFile) {
      setError('Report file is required for this project.');
      setLoading(false);
      return;
    }
    
    if (!studentId.trim()) {
      setError('Please enter your student ID.');
      setLoading(false);
      return;
    }
    
    // Create form data for the submission
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('studentId', studentId);
    formData.append('studentName', studentName);
    
    if (codeFile) {
      formData.append('codeFile', codeFile);
    }
    
    if (reportFile) {
      formData.append('reportFile', reportFile);
    }
    
    try {
      await api.post('/api/projects/project-submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess('Project submission uploaded successfully! Your submission is being processed.');
      
      // Navigate to results page after a short delay
      setTimeout(() => {
        navigate(`/projects/${projectId}/results?studentId=${studentId}`);
      }, 2000);
      
    } catch (err) {
      console.error('Error submitting project:', err);
      setError(err.response?.data?.message || 'Failed to submit project. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (formLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Loading project details...</p>
      </Container>
    );
  }
  
  if (!projectData) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <FiInfo className="me-2" />
          Unable to load project information. Please try again later or contact support.
        </Alert>
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate('/projects')}
          className="mt-3"
        >
          Back to Projects
        </Button>
      </Container>
    );
  }
  
  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col lg={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h2 className="mb-0">Submit Project Work</h2>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="mb-4">
                <h4>{projectData.title}</h4>
                <p className="text-muted">{projectData.course}</p>
                {projectData.dueDate && (
                  <Alert variant="light" className="d-inline-block py-2">
                    <FiInfo className="me-2" />
                    Due: {new Date(projectData.dueDate).toLocaleDateString()}
                  </Alert>
                )}
              </div>
              
              {error && <Alert variant="danger" onClose={() => setError(null)} dismissible><FiInfo className="me-2" />{error}</Alert>}
              {success && <Alert variant="success"><FiInfo className="me-2" />{success}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="studentId">
                      <Form.Label>Student ID</Form.Label>
                      <Form.Control
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                        placeholder="e.g., z1234567"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="studentName">
                      <Form.Label>Name (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g., John Smith"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                {(projectData.codeRequired || !projectData.reportRequired) && (
                  <Form.Group className="mb-4" controlId="codeFile">
                    <Form.Label>
                      <FiCode className="me-2" />
                      Code File {projectData.codeRequired ? '(Required)' : '(Optional)'}
                    </Form.Label>
                    <FileDropzone
                      onDrop={handleCodeFileDrop}
                      accept={{
                        'application/python': ['.py'],
                        'text/x-python': ['.py'],
                        'application/x-ipynb+json': ['.ipynb'],
                        'text/plain': ['.txt', '.py', '.java', '.js', '.c', '.cpp', '.h', '.cs'],
                        'application/zip': ['.zip'],
                        'application/x-zip-compressed': ['.zip']
                      }}
                      maxFiles={1}
                      existingFileName={codeFile?.name}
                      promptText="Drag 'n' drop your code file (.py, .ipynb, etc.) here, or click to select"
                    />
                    <Form.Text className="text-muted">
                      Accepted formats: Python (.py, .ipynb), Java, JavaScript, C/C++, or ZIP archive for multiple files
                    </Form.Text>
                  </Form.Group>
                )}
                
                {(projectData.reportRequired || !projectData.codeRequired) && (
                  <Form.Group className="mb-4" controlId="reportFile">
                    <Form.Label>
                      <FiFileText className="me-2" />
                      Project Report {projectData.reportRequired ? '(Required)' : '(Optional)'}
                    </Form.Label>
                    <FileDropzone
                      onDrop={handleReportFileDrop}
                      accept={{ 'application/pdf': ['.pdf'] }}
                      maxFiles={1}
                      existingFileName={reportFile?.name}
                      promptText="Drag 'n' drop your report (PDF) here, or click to select"
                    />
                    <Form.Text className="text-muted">
                      Only PDF format is accepted for reports
                    </Form.Text>
                  </Form.Group>
                )}
                
                <hr className="my-4" />
                
                <div className="d-flex justify-content-between">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => navigate('/projects')}
                    disabled={loading}
                  >
                    <FiXCircle className="me-2" />Cancel
                  </Button>
                  <Button 
                    variant="success" 
                    type="submit"
                    disabled={loading || 
                      (projectData.codeRequired && !codeFile) || 
                      (projectData.reportRequired && !reportFile) ||
                      !studentId.trim()
                    }
                  >
                    {loading ? (
                      <><Spinner as="span" animation="border" size="sm" className="me-2" />Submitting...</>
                    ) : (
                      <><FiSend className="me-2" />Submit Project</>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProjectSubmissionForm;