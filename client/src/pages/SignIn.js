import React from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { Container, Row, Col, Card } from 'react-bootstrap';

const SignIn = () => {
  return (
    <Container className="mt-5 pt-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <div className="text-center mb-4">
            <h2 className="mb-2">Welcome Back to EduGrade</h2>
            <p className="text-muted">Sign in to access your assignments and grading tools</p>
          </div>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-center">
                <ClerkSignIn
                  routing="path"
                  path="/sign-in"
                  signUpUrl="/sign-up"
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

export default SignIn;
