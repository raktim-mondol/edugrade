import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import FileDropzone from '../components/FileDropzone';
import { FiInfo, FiCheckCircle, FiFileText, FiBook, FiCalendar, FiAlignLeft, FiArrowLeft, FiUpload, FiSave, FiPlus, FiTrash2, FiList } from 'react-icons/fi';

const AssignmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState(''); 
  const [dueDate, setDueDate] = useState('');
  const [totalPoints, setTotalPoints] = useState('');
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [solutionFile, setSolutionFile] = useState(null);
  const [rubricFile, setRubricFile] = useState(null);
  const [sections, setSections] = useState([{ title: '', description: '' }]);
  
  const [loading, setLoading] = useState(false);
  const [loadingAssignment, setLoadingAssignment] = useState(isEditing);
  const [error, setError] = useState(null);
  const [showFileInfo, setShowFileInfo] = useState(false);
  
  // Fetch assignment details if editing an existing assignment
  useEffect(() => {
    if (isEditing) {
      const fetchAssignment = async () => {
        try {
          const { data } = await axios.get(`/api/assignments/${id}`);
          setTitle(data.assignment.title);
          setDescription(data.assignment.description);
          setCourse(data.assignment.course); 
          setTotalPoints(data.assignment.totalPoints || '');
          setSections(data.assignment.sections && data.assignment.sections.length > 0 ? data.assignment.sections : [{ title: '', description: '' }]);
          
          // Format the date for the input if available
          if (data.assignment.dueDate) {
            const date = new Date(data.assignment.dueDate);
            setDueDate(date.toISOString().split('T')[0]); // Format to YYYY-MM-DD
          }
          
          setLoadingAssignment(false);
        } catch (err) {
          console.error('Error fetching assignment:', err);
          setError('Failed to load assignment details. Please try again.');
          setLoadingAssignment(false);
        }
      };
      
      fetchAssignment();
    }
  }, [id, isEditing]);
  
  // Section Management Handlers
  const handleAddSection = () => {
    setSections([...sections, { title: '', description: '' }]);
  };

  const handleRemoveSection = (index) => {
    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections.length > 0 ? newSections : [{ title: '', description: '' }]);
  };

  const handleSectionChange = (index, field, value) => {
    const newSections = sections.map((section, i) => {
      if (i === index) {
        return { ...section, [field]: value };
      }
      return section;
    });
    setSections(newSections);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please enter a title for the assignment.');
      return;
    }
    
    if (!description.trim()) {
      setError('Please enter a description for the assignment.');
      return;
    }
    
    if (!course.trim()) {
      setError('Please enter a course name for the assignment.');
      return;
    }
    
    if (!totalPoints) {
      setError('Please enter total points for the assignment.');
      return;
    }
    
    // For new assignments, make sure assignment file is provided
    if (!isEditing && !assignmentFile) {
      setError('Please upload an assignment file.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('course', course);
      formData.append('dueDate', dueDate);
      
      if (totalPoints) {
        formData.append('totalPoints', totalPoints);
      }
      
      // Let the API extract total points from the PDF
      // Send empty array for question structure since we're removing that feature
      formData.append('questionStructure', JSON.stringify([]));
      
      // Append sections data
      const sectionsToSend = sections.filter(s => s.title.trim() !== '' || s.description.trim() !== '');
      formData.append('sections', JSON.stringify(sectionsToSend));
      
      if (assignmentFile) {
        formData.append('assignment', assignmentFile);
      }
      
      if (solutionFile) {
        formData.append('solution', solutionFile);
      }
      
      if (rubricFile) {
        formData.append('rubric', rubricFile);
      }
      
      let response;
      if (isEditing) {
        // If editing, update and go back to assignment list
        response = await axios.put(`/api/assignments/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        navigate('/assignments');
      } else {
        // If creating new, create and redirect to processing page
        response = await axios.post('/api/assignments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Get the ID of the new assignment from the response
        const newAssignmentId = response.data.assignment._id;
        
        // Redirect to the processing status page
        navigate(`/assignments/${newAssignmentId}/processing`);
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      setError('Failed to save assignment. Please try again.');
    } finally {
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
            <h2 className="mb-0 fw-bold">
              {isEditing ? 'Edit Assignment' : 'Create New Assignment'}
            </h2>
          </div>
          {isEditing && (
            <div className="ms-4 ps-4 border-start border-3 mt-2">
              <h4 className="text-primary mb-0">{title}</h4>
              <p className="text-muted">{course}</p>
            </div>
          )}
        </Col>
      </Row>
      
      {error && (
        <Alert variant="danger" className="d-flex align-items-center shadow-sm border-0">
          <FiInfo size={24} className="me-3 flex-shrink-0" />
          <div>{error}</div>
        </Alert>
      )}
      
      <Form onSubmit={handleSubmit}>
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Header className="bg-white">
            <h5 className="mb-0 fw-bold">Assignment Details</h5>
          </Card.Header>
          <Card.Body className="p-4">
            <Row className="mb-4">
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium d-flex align-items-center">
                    <FiFileText className="me-2 text-primary" />
                    Assignment Title <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter assignment title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium d-flex align-items-center">
                    <FiCheckCircle className="me-2 text-primary" />
                    Total Points <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="e.g., 100"
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(e.target.value)}
                    min="0"
                    required
                  />
                  <Form.Text className="text-muted">
                    Maximum points for this assignment
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Row className="mb-4">
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium d-flex align-items-center">
                    <FiBook className="me-2 text-primary" />
                    Course Code <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., COMP9444, CS101"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium d-flex align-items-center">
                    <FiAlignLeft className="me-2 text-primary" />
                    Course Name <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter course name"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-medium d-flex align-items-center">
                    <FiCalendar className="me-2 text-primary" />
                    Due Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Form.Text className="text-muted">
                    Optional. Future dates only.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Header className="bg-white">
            <h5 className="mb-0 fw-bold d-flex align-items-center">
              <FiList className="me-2 text-primary" /> Assignment Sections (Optional)
            </h5>
          </Card.Header>
          <Card.Body className="p-4">
            <p className="text-muted small mb-4">
              Divide the assignment into logical sections or parts. This can help structure the evaluation process.
            </p>
            {sections.map((section, index) => (
              <Card key={index} className="mb-3 bg-light border">
                <Card.Body>
                  <Row className="align-items-center">
                    <Col>
                      <Form.Group className="mb-2">
                        <Form.Label className="fw-medium small">Section {index + 1} Title</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder={`Enter title for Section ${index + 1}`}
                          value={section.title}
                          onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Section Description (Optional)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder={`Enter description for Section ${index + 1}`}
                          value={section.description}
                          onChange={(e) => handleSectionChange(index, 'description', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col xs="auto">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleRemoveSection(index)}
                        disabled={sections.length <= 1}
                        className="mt-4"
                        title="Remove Section"
                      >
                        <FiTrash2 />
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            ))}
            <Button
              variant="outline-primary"
              onClick={handleAddSection}
              className="mt-2 d-flex align-items-center"
            >
              <FiPlus className="me-2" /> Add Section
            </Button>
          </Card.Body>
        </Card>
        
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">File Uploads</h5>
            <Button 
              variant="link" 
              className="text-decoration-none p-0 text-muted" 
              onClick={() => setShowFileInfo(!showFileInfo)}
            >
              <FiInfo size={16} />
            </Button>
          </Card.Header>
          <Card.Body className="p-4">
            {showFileInfo && (
              <Alert variant="info" className="mb-4 border-0 d-flex shadow-sm">
                <div>
                  <h6 className="fw-bold mb-2">About Document Uploads</h6>
                  <p className="mb-2 small">For best results:</p>
                  <ul className="small mb-0">
                    <li>Assignment document is required</li>
                    <li>Upload rubric for better evaluation</li>
                    <li>Solution file helps with feedback</li>
                    <li>PDF files are recommended</li>
                  </ul>
                </div>
              </Alert>
            )}
            
            <Row>
              <Col md={4}>
                <div className="h-100">
                  <h6 className="d-flex align-items-center mb-3">
                    <span className="bg-primary text-white rounded-circle p-1 d-inline-flex align-items-center justify-content-center me-2" style={{ width: '22px', height: '22px' }}>
                      <small>1</small>
                    </span>
                    Assignment Document 
                    {!isEditing && <Badge bg="danger" className="ms-2">Required</Badge>}
                    {isEditing && <Badge bg="success" className="ms-2">Uploaded</Badge>}
                  </h6>
                  <FileDropzone
                    accept={{
                      'application/pdf': ['.pdf'],
                      'text/plain': ['.txt'],
                      'application/msword': ['.doc', '.docx']
                    }}
                    onFileUpload={(file) => setAssignmentFile(file)}
                    title={isEditing ? "Replace Assignment" : "Upload Assignment"}
                    subtitle="PDF, Word or Text files"
                    className="file-upload-box"
                  />
                </div>
              </Col>
              
              <Col md={4}>
                <div className="h-100">
                  <h6 className="d-flex align-items-center mb-3">
                    <span className="bg-primary text-white rounded-circle p-1 d-inline-flex align-items-center justify-content-center me-2" style={{ width: '22px', height: '22px' }}>
                      <small>2</small>
                    </span>
                    Rubric File
                    <Badge bg="info" className="ms-2">Recommended</Badge>
                  </h6>
                  <FileDropzone
                    accept={{
                      'application/pdf': ['.pdf'],
                      'text/plain': ['.txt'],
                      'application/msword': ['.doc', '.docx'],
                      'application/vnd.ms-excel': ['.xls', '.xlsx']
                    }}
                    onFileUpload={(file) => setRubricFile(file)}
                    title="Upload Rubric"
                    subtitle="PDF, Excel, Word or Text"
                    className="file-upload-box"
                  />
                </div>
              </Col>
              
              <Col md={4}>
                <div className="h-100">
                  <h6 className="d-flex align-items-center mb-3">
                    <span className="bg-primary text-white rounded-circle p-1 d-inline-flex align-items-center justify-content-center me-2" style={{ width: '22px', height: '22px' }}>
                      <small>3</small>
                    </span>
                    Solution File
                    <Badge bg="secondary" className="ms-2">Optional</Badge>
                  </h6>
                  <FileDropzone
                    accept={{
                      'application/pdf': ['.pdf'],
                      'text/plain': ['.txt'],
                      'application/msword': ['.doc', '.docx']
                    }}
                    onFileUpload={(file) => setSolutionFile(file)}
                    title="Upload Solution"
                    subtitle="PDF, Word or Text files"
                    className="file-upload-box"
                  />
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        <div className="d-flex justify-content-between mt-4">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/assignments')} 
            className="d-flex align-items-center"
            disabled={loading}
          >
            <FiArrowLeft className="me-2" /> Back to Assignments
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading}
            className="px-4 d-flex align-items-center"
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
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                {isEditing ? (
                  <>
                    <FiSave className="me-2" /> Update Assignment
                  </>
                ) : (
                  <>
                    <FiUpload className="me-2" /> Create Assignment
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </Form>
      
      <style jsx="true">{`
        .file-upload-box {
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          transition: var(--transition);
          overflow: hidden;
          height: calc(100% - 40px);
        }
        
        .file-upload-box:hover {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.15);
        }
      `}</style>
    </Container>
  );
};

export default AssignmentForm;