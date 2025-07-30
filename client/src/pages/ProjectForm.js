import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Alert, Card } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileDropzone from '../components/FileDropzone';
import { FiSave, FiXCircle, FiInfo, FiCode, FiFileText } from 'react-icons/fi';

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [projectData, setProjectData] = useState({
    title: '',
    course: '',
    description: '',
    dueDate: '',
    totalPoints: 100,
    codeRequired: true,
    reportRequired: true,
  });
  const [projectFile, setProjectFile] = useState(null);
  const [rubricFile, setRubricFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formLoading, setFormLoading] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      const fetchProject = async () => {
        try {
          setFormLoading(true);
          const response = await axios.get(`/api/projects/${id}`);
          const project = response.data.project;
          setProjectData({
            title: project.title || '',
            course: project.course || '',
            description: project.description || '',
            dueDate: project.dueDate ? project.dueDate.split('T')[0] : '',
            totalPoints: project.totalPoints || 100,
            codeRequired: project.codeRequired !== undefined ? project.codeRequired : true,
            reportRequired: project.reportRequired !== undefined ? project.reportRequired : true,
          });
          // Note: We don't fetch existing files for editing, user needs to re-upload if changes are needed.
        } catch (err) {
          console.error('Error fetching project:', err);
          setError('Failed to load project data. Please try again.');
        } finally {
          setFormLoading(false);
        }
      };
      fetchProject();
    }
  }, [id, isEditing]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProjectData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProjectFileDrop = (file) => {
    console.log("Project file dropped:", file);
    if (file) {
      setProjectFile(file);
    } else {
      setProjectFile(null); // Handle file removal
    }
  };

  const handleRubricFileDrop = (file) => {
    console.log("Rubric file dropped:", file);
    if (file) {
      setRubricFile(file);
    } else {
      setRubricFile(null); // Handle file removal
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!projectData.title || !projectData.course || !projectData.dueDate) {
      setError('Please fill in all required fields: Title, Course, and Due Date.');
      setLoading(false);
      return;
    }
    if (!projectData.codeRequired && !projectData.reportRequired) {
      setError('At least one submission type (Code or Report) must be required.');
      setLoading(false);
      return;
    }

    // Check for project file when creating a new project
    if (!isEditing && !projectFile) {
      setError('Project details file (PDF) is required.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    
    // Set string values
    formData.append('title', projectData.title);
    formData.append('course', projectData.course);
    formData.append('description', projectData.description || '');
    formData.append('dueDate', projectData.dueDate || '');
    formData.append('totalPoints', projectData.totalPoints || 100);
    
    // Set boolean values explicitly as strings "true" or "false"
    formData.append('codeRequired', projectData.codeRequired ? 'true' : 'false');
    formData.append('reportRequired', projectData.reportRequired ? 'true' : 'false');

    // Only append files if they exist
    if (projectFile) {
      formData.append('projectDetails', projectFile);
    }
    if (rubricFile) {
      formData.append('rubric', rubricFile);
    }

    try {
      console.log('Submitting form data:', {
        title: projectData.title,
        course: projectData.course,
        codeRequired: projectData.codeRequired ? 'true' : 'false',
        reportRequired: projectData.reportRequired ? 'true' : 'false',
        hasProjectFile: Boolean(projectFile),
        hasRubricFile: Boolean(rubricFile)
      });

      if (isEditing) {
        // Update existing project
        await axios.put(`/api/projects/${id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        setSuccess('Project updated successfully!');
      } else {
        // Create new project
        await axios.post('/api/projects', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        setSuccess('Project created successfully!');
      }
      
      // Optionally navigate after a short delay
      setTimeout(() => {
        navigate('/projects'); // Navigate to the project list page
      }, 1500); 

    } catch (err) {
      console.error('Error submitting project:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} project. Please try again.`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (formLoading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading project details...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col lg={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h2 className="mb-0">{isEditing ? 'Edit Project' : 'Create New Project'}</h2>
            </Card.Header>
            <Card.Body className="p-4">
              {error && <Alert variant="danger" onClose={() => setError(null)} dismissible><FiInfo className="me-2" />{error}</Alert>}
              {success && <Alert variant="success"><FiInfo className="me-2" />{success}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="projectTitle">
                      <Form.Label>Project Title</Form.Label>
                      <Form.Control
                        type="text"
                        name="title"
                        value={projectData.title}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., Final Year Project - AI Tutor"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="projectCourse">
                      <Form.Label>Course</Form.Label>
                      <Form.Control
                        type="text"
                        name="course"
                        value={projectData.course}
                        onChange={handleInputChange}
                        placeholder="e.g., COMP90082"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3" controlId="projectDescription">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={projectData.description}
                    onChange={handleInputChange}
                    placeholder="Provide a brief description of the project requirements and goals."
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="projectDueDate">
                      <Form.Label>Due Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="dueDate"
                        value={projectData.dueDate}
                        onChange={handleInputChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="projectTotalPoints">
                      <Form.Label>Total Points</Form.Label>
                      <Form.Control
                        type="number"
                        name="totalPoints"
                        value={projectData.totalPoints}
                        onChange={handleInputChange}
                        min="0"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Check 
                      type="switch"
                      id="code-required-switch"
                      label={<><FiCode className="me-1"/> Code Submission Required</>}
                      name="codeRequired"
                      checked={projectData.codeRequired}
                      onChange={handleInputChange}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Check 
                      type="switch"
                      id="report-required-switch"
                      label={<><FiFileText className="me-1"/> Report Submission Required</>}
                      name="reportRequired"
                      checked={projectData.reportRequired}
                      onChange={handleInputChange}
                    />
                  </Col>
                </Row>

                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Group controlId="projectFile">
                      <Form.Label>Project Details File (PDF)</Form.Label>
                      <FileDropzone
                        onFileUpload={handleProjectFileDrop}
                        accept={{ 
                          'application/pdf': ['.pdf'],
                          'application/x-pdf': ['.pdf'],
                          'application/acrobat': ['.pdf'],
                          'application/vnd.pdf': ['.pdf'],
                          'text/pdf': ['.pdf'],
                          'text/x-pdf': ['.pdf']
                        }}
                        maxFiles={1}
                        existingFileName={projectFile?.name}
                        promptText="Drag 'n' drop project details PDF here, or click to select"
                      />
                      {isEditing && !projectFile && <Form.Text className="text-muted">Leave empty to keep the existing file.</Form.Text>}
                    </Form.Group>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Group controlId="rubricFile">
                      <Form.Label>Marking Rubric (PDF)</Form.Label>
                      <FileDropzone
                        onDrop={handleRubricFileDrop}
                        onFileUpload={handleRubricFileDrop}
                        accept={{ 
                          'application/pdf': ['.pdf'],
                          'application/x-pdf': ['.pdf'],
                          'application/acrobat': ['.pdf'],
                          'application/vnd.pdf': ['.pdf'],
                          'text/pdf': ['.pdf'],
                          'text/x-pdf': ['.pdf']
                        }}
                        maxFiles={1}
                        existingFileName={rubricFile?.name}
                        promptText="Drag 'n' drop rubric PDF here, or click to select"
                      />
                      {isEditing && !rubricFile && <Form.Text className="text-muted">Leave empty to keep the existing file.</Form.Text>}
                    </Form.Group>
                  </Col>
                </Row>

                <hr className="my-4" />

                <div className="d-flex justify-content-end gap-2">
                  <Button variant="outline-secondary" onClick={() => navigate('/projects')} disabled={loading}>
                    <FiXCircle className="me-2" />Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={loading || (!projectData.codeRequired && !projectData.reportRequired)}>
                    {loading ? (
                      <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Saving...</>
                    ) : (
                      <><FiSave className="me-2" /> {isEditing ? 'Update Project' : 'Create Project'}</>
                    )}
                  </Button>
                </div>
                {(!projectData.codeRequired && !projectData.reportRequired) && 
                  <Alert variant="warning" className="mt-3">
                    <FiInfo className="me-1"/> At least one submission type (Code or Report) must be required.
                  </Alert>
                }
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProjectForm;