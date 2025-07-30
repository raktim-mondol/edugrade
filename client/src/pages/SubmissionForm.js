import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner, Nav, Tab } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import FileDropzone from '../components/FileDropzone';
import { FiUpload, FiUser, FiUsers, FiArrowLeft, FiInfo, FiFileText, FiCheck, FiBarChart2 } from 'react-icons/fi';

const SubmissionForm = () => {
  const navigate = useNavigate();
  const { id: assignmentId } = useParams();
  
  const [assignment, setAssignment] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [singleSubmissionFile, setSingleSubmissionFile] = useState(null);
  const [batchSubmissionFiles, setBatchSubmissionFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [error, setError] = useState(null);
  const [uploadMode, setUploadMode] = useState('single');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Fetch assignment details
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const { data } = await axios.get(`/api/assignments/${assignmentId}`);
        setAssignment(data.assignment); // Extract assignment from response object
        setLoadingAssignment(false);
      } catch (err) {
        console.error('Error fetching assignment:', err);
        setError('Failed to load assignment details. Please try again.');
        setLoadingAssignment(false);
      }
    };
    
    fetchAssignment();
  }, [assignmentId]);
  
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentId.trim()) {
      setError('Please enter a student ID.');
      return;
    }
    
    if (!singleSubmissionFile) {
      setError('Please upload a submission file.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create form data with correct field names expected by server
      const formData = new FormData();
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);
      formData.append('studentName', studentName || studentId); // Use studentId as name if not provided
      
      // This must match the field name expected by multer middleware (upload.single('submission'))
      formData.append('submission', singleSubmissionFile); 
      
      console.log('Submitting form data:', {
        assignmentId,
        studentId,
        studentName: studentName || studentId,
        fileSize: singleSubmissionFile.size,
        fileName: singleSubmissionFile.name,
        fileType: singleSubmissionFile.type
      });
      
      // Use baseURL to ensure we're hitting the right endpoint
      const { data } = await axios.post('/api/submissions/single', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Submission response:', data);
      setUploadSuccess(true);
      
      // Small delay to ensure server has time to process before navigation
      setTimeout(() => {
        navigate(`/assignments/${assignmentId}/results`);
      }, 1500);
    } catch (err) {
      console.error('Error uploading submission:', err);
      // Show more detailed error info if available
      const errorMessage = err.response?.data?.error || 'Failed to upload submission. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };
  
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    
    if (!batchSubmissionFiles || batchSubmissionFiles.length === 0) {
      setError('Please upload at least one submission file.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('assignmentId', assignmentId);
      
      // Append each file to the form data
      batchSubmissionFiles.forEach((file) => {
        formData.append('submissions', file);
      });
      
      await axios.post('/api/submissions/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadSuccess(true);
      
      // Small delay to ensure server has time to process before navigation
      setTimeout(() => {
        navigate(`/assignments/${assignmentId}/results`);
      }, 1500);
    } catch (err) {
      console.error('Error uploading batch submissions:', err);
      const errorMessage = err.response?.data?.error || 'Failed to upload submissions. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };
  
  if (loadingAssignment) {
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
  
  if (uploadSuccess) {
    return (
      <Container className="py-5">
        <div className="text-center d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
          <div className="mb-4 p-4 bg-success bg-opacity-10 rounded-circle">
            <FiCheck size={60} className="text-success" />
          </div>
          <h2 className="mb-3">Upload Successful!</h2>
          <p className="text-muted mb-4">
            {uploadMode === 'single' ? 
              'Student submission has been uploaded and is being evaluated.' :
              `${batchSubmissionFiles.length} submissions have been uploaded and are being evaluated.`
            }
          </p>
          <p>Redirecting to results page...</p>
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
              onClick={() => navigate(`/assignments/${assignmentId}/results`)}
            >
              <FiArrowLeft size={20} />
            </Button>
            <h2 className="mb-0 fw-bold">Submit Student Work</h2>
          </div>
          
          {assignment && (
            <div className="ms-4 ps-4 border-start border-3">
              <h4 className="text-primary mb-1">{assignment.title}</h4>
              <p className="text-muted mb-1">
                Course: {assignment.course}
                {assignment.totalPoints && <span className="ms-2">• {assignment.totalPoints} Points</span>}
              </p>
              {assignment.dueDate && (
                <p className="text-muted mb-0">
                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </Col>
        <Col xs="auto" className="d-flex align-items-start">
          <Button 
            variant="outline-info" 
            onClick={() => navigate(`/assignments/${assignmentId}/results`)}
            className="d-flex align-items-center"
          >
            <FiBarChart2 className="me-2" /> 
            View Results
          </Button>
        </Col>
      </Row>
      
      {error && (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm border-0">
          <FiInfo size={24} className="me-3 flex-shrink-0" />
          <div>{error}</div>
        </Alert>
      )}
      
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white">
          <Nav variant="tabs" className="nav-tabs-modern" activeKey={uploadMode} onSelect={(k) => setUploadMode(k)}>
            <Nav.Item>
              <Nav.Link eventKey="single" className="d-flex align-items-center">
                <FiUser className="me-2" />
                <span>Single Submission</span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="batch" className="d-flex align-items-center">
                <FiUsers className="me-2" />
                <span>Batch Submissions</span>
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        
        <Card.Body className="p-4">
          <Tab.Content>
            <Tab.Pane active={uploadMode === 'single'}>
              <Form onSubmit={handleSingleSubmit}>
                <Row>
                  <Col md={6} className="mb-4">
                    <div className="p-4 border rounded-3 h-100">
                      <h5 className="mb-4 d-flex align-items-center">
                        <FiUser className="me-2 text-primary" />
                        Student Information
                      </h5>
                      
                      <Form.Group className="mb-4">
                        <Form.Label>Student ID <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter student ID"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          required
                        />
                        <Form.Text className="text-muted">
                          Enter the student's unique identifier (e.g., student number)
                        </Form.Text>
                      </Form.Group>
                      
                      <Form.Group className="mb-0">
                        <Form.Label>Student Name (Optional)</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter student name"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                        />
                      </Form.Group>
                    </div>
                  </Col>
                  
                  <Col md={6} className="mb-4">
                    <div className="p-4 border rounded-3 h-100">
                      <h5 className="mb-4 d-flex align-items-center">
                        <FiFileText className="me-2 text-primary" />
                        Submission File
                      </h5>
                      
                      <FileDropzone
                        accept={{
                          'application/pdf': ['.pdf'],
                          'application/x-ipynb+json': ['.ipynb'],
                          'application/json': ['.json', '.ipynb'],
                          'text/plain': ['.txt'],
                          'application/msword': ['.doc', '.docx'],
                          'application/vnd.ms-excel': ['.xls', '.xlsx'],
                          'application/zip': ['.zip'],
                          'text/javascript': ['.js'],
                          'text/html': ['.html'],
                          'text/css': ['.css'],
                          'text/x-python': ['.py']
                        }}
                        onFileUpload={(file) => setSingleSubmissionFile(file)}
                        title="Upload Submission"
                        subtitle="Drop student's work file here (PDF, Jupyter Notebook, or other supported formats)"
                      />
                    </div>
                  </Col>
                </Row>
                
                <div className="d-flex justify-content-end mt-3 gap-3">
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate('/assignments')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loading || !studentId || !singleSubmissionFile}
                    className="px-4"
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FiUpload className="me-2" /> Submit & Evaluate
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Tab.Pane>
            
            <Tab.Pane active={uploadMode === 'batch'}>
              <Form onSubmit={handleBatchSubmit}>
                <Alert variant="info" className="d-flex border-0 shadow-sm mb-4">
                  <FiInfo size={24} className="me-3 flex-shrink-0 mt-1" />
                  <div>
                    <h5 className="mb-2">Batch Upload Instructions</h5>
                    <p className="mb-2">For batch uploads, please ensure each file is named with the student's ID followed by the file extension:</p>
                    <div className="bg-light p-2 rounded mb-2">
                      <code>StudentID.ext</code> (e.g., <code>12345.pdf</code>)
                    </div>
                    <p className="mb-0">This naming convention allows the system to automatically extract student IDs.</p>
                  </div>
                </Alert>
                
                <div className="border rounded-3 p-4">
                  <h5 className="mb-4 d-flex align-items-center">
                    <FiUsers className="me-2 text-primary" /> 
                    Multiple Submissions
                  </h5>
                  
                  <FileDropzone
                    accept={{
                      'application/pdf': ['.pdf'],
                      'application/x-ipynb+json': ['.ipynb'],
                      'application/json': ['.json', '.ipynb'],
                      'text/plain': ['.txt'],
                      'application/msword': ['.doc', '.docx'],
                      'application/vnd.ms-excel': ['.xls', '.xlsx'],
                      'application/zip': ['.zip'],
                      'text/javascript': ['.js'],
                      'text/html': ['.html'],
                      'text/css': ['.css'],
                      'text/x-python': ['.py']
                    }}
                    onFileUpload={(files) => setBatchSubmissionFiles(files)}
                    maxFiles={50}
                    title="Upload Multiple Submissions"
                    subtitle="Drop up to 50 student files here (PDF, Jupyter Notebook, or other formats)"
                  />
                </div>
                
                <div className="d-flex justify-content-end mt-4 gap-3">
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate('/assignments')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loading || batchSubmissionFiles.length === 0}
                    className="px-4"
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Uploading {batchSubmissionFiles.length} files...
                      </>
                    ) : (
                      <>
                        <FiUpload className="me-2" /> Submit & Evaluate ({batchSubmissionFiles.length} files)
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Tab.Pane>
          </Tab.Content>
        </Card.Body>
      </Card>
      
      <style jsx="true">{`
        .nav-tabs-modern {
          border-bottom: none;
        }
        
        .nav-tabs-modern .nav-link {
          border: none;
          padding: 1rem 1.5rem;
          color: #6c757d;
          font-weight: 500;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }
        
        .nav-tabs-modern .nav-link:hover:not(.active) {
          border-bottom-color: #dee2e6;
          background-color: rgba(0, 0, 0, 0.02);
        }
        
        .nav-tabs-modern .nav-link.active {
          color: #4285F4;
          border-bottom-color: #4285F4;
          background-color: transparent;
        }
        
        @media (max-width: 768px) {
          .nav-tabs-modern .nav-link {
            padding: 0.75rem;
          }
        }
      `}</style>
    </Container>
  );
};

export default SubmissionForm;