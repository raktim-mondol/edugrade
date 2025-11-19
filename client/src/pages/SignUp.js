import React from 'react';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { Container, Row, Col, Card } from 'react-bootstrap';

const SignUp = () => {
  return (
    <Container className="mt-5 pt-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <div className="text-center mb-4">
            <h2 className="mb-2">Join EduGrade</h2>
            <p className="text-muted">Create an account to start grading assignments with AI</p>
          </div>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-center">
                <ClerkSignUp
                  routing="path"
                  path="/sign-up"
                  signInUrl="/sign-in"
                  redirectUrl="/"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'btn btn-primary',
                      card: 'shadow-none border-0',
                    }
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default SignUp;
