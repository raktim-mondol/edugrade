import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiFileText, FiUpload, FiCheckSquare, FiBarChart2, FiArrowRight } from 'react-icons/fi';

const Home = () => {
  return (
    <Container>
      <Row className="align-items-center mb-5">
        <Col lg={7}>
          <div className="py-5">
            <h1 className="display-4 fw-bold mb-3">Assignment Evaluation System</h1>
            <p className="lead fs-5 text-muted mb-4">
              Streamline the grading process using AI to evaluate student submissions against 
              predefined solutions and marking rubrics — making assessment faster, more consistent, and insightful.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Link to="/assignments/new">
                <Button variant="primary" size="lg" className="rounded-pill shadow-sm">
                  Create New Assignment
                  <FiArrowRight className="ms-2" />
                </Button>
              </Link>
              <Link to="/assignments">
                <Button variant="outline-secondary" size="lg" className="rounded-pill">
                  View Assignments
                </Button>
              </Link>
            </div>
          </div>
        </Col>
        <Col lg={5} className="d-none d-lg-block">
          <div className="p-4 bg-light rounded-circle text-center shadow-sm" style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <img 
              src="https://img.icons8.com/color/240/000000/student-center.png" 
              alt="Education illustration" 
              className="img-fluid mt-4"
              style={{ maxWidth: '90%' }}
            />
          </div>
        </Col>
      </Row>

      <Row className="py-4">
        <Col className="text-center">
          <h2 className="fw-bold">How It Works</h2>
          <p className="text-muted mb-4">Automated grading powered by AI — Consistent, detailed, and efficient</p>
        </Col>
      </Row>

      <Row className="g-4 mb-5">
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="rounded-circle bg-primary bg-opacity-10 p-3 d-inline-flex mb-3">
                <FiFileText size={36} className="text-primary" />
              </div>
              <Card.Title className="fw-bold mb-3">Upload Assignment</Card.Title>
              <Card.Text className="text-muted">
                Create assignments and upload solution files with detailed rubrics for precise evaluation
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="rounded-circle bg-success bg-opacity-10 p-3 d-inline-flex mb-3">
                <FiUpload size={36} className="text-success" />
              </div>
              <Card.Title className="fw-bold mb-3">Submit Work</Card.Title>
              <Card.Text className="text-muted">
                Upload individual or batch student submissions for quick and efficient evaluation
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="rounded-circle bg-warning bg-opacity-10 p-3 d-inline-flex mb-3">
                <FiCheckSquare size={36} className="text-warning" />
              </div>
              <Card.Title className="fw-bold mb-3">AI Grading</Card.Title>
              <Card.Text className="text-muted">
                AI evaluates submissions against solutions based on the rubric with high precision
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="rounded-circle bg-info bg-opacity-10 p-3 d-inline-flex mb-3">
                <FiBarChart2 size={36} className="text-info" />
              </div>
              <Card.Title className="fw-bold mb-3">View Results</Card.Title>
              <Card.Text className="text-muted">
                View detailed evaluation results and download them in Excel format for analysis
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="py-5 mt-3">
        <Col>
          <Card className="border-0 bg-primary bg-opacity-10 shadow-sm">
            <Card.Body className="p-4 p-md-5">
              <h2 className="fw-bold mb-4">About EduGrade</h2>
              <p className="fs-5">
                EduGrade is an advanced assignment evaluation system that uses Large Language Model (LLM) APIs 
                to automate the grading process. The system compares student submissions against model solutions 
                using the criteria defined in your rubric, providing consistent, objective evaluations.
              </p>
              <p className="fs-5 mb-4">
                Supporting multiple LLM providers like OpenAI, Anthropic, and Google Gemini, 
                EduGrade gives you flexibility in choosing the most appropriate AI model for your specific 
                evaluation needs.
              </p>
              <Link to="/assignments">
                <Button variant="primary" size="lg" className="rounded-pill">
                  Get Started <FiArrowRight className="ms-2" />
                </Button>
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;