import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FiBookOpen, FiHome, FiFileText } from 'react-icons/fi';
import { useAuth, UserButton } from '@clerk/clerk-react';

const Header = () => {
  const location = useLocation();
  const { isSignedIn } = useAuth();

  return (
    <header>
      <Navbar bg="white" expand="lg" className="shadow-sm py-3 fixed-top">
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
            <FiBookOpen size={24} className="me-2 text-primary" />
            <div>
              <strong style={{ fontSize: '1.3rem', letterSpacing: '-0.5px' }}>EduGrade</strong>
              <span className="text-muted d-none d-md-inline ms-2" style={{ fontSize: '0.9rem' }}>| Assignment Evaluation System</span>
            </div>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto align-items-center">
              <Nav.Link
                as={Link}
                to="/"
                className={`mx-1 ${location.pathname === '/' ? 'active' : ''}`}
              >
                <FiHome className="me-1" /> Home
              </Nav.Link>

              {isSignedIn && (
                <Nav.Link
                  as={Link}
                  to="/assignments"
                  className={`mx-1 ${location.pathname.includes('/assignments') ? 'active' : ''}`}
                >
                  <FiFileText className="me-1" /> Assignments
                </Nav.Link>
              )}

              {isSignedIn ? (
                <>
                  <Link to="/assignments/new" className="ms-3 d-none d-md-block">
                    <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2">
                      Create New Assignment
                    </Button>
                  </Link>
                  <div className="ms-3">
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: 'w-10 h-10'
                        }
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Link to="/sign-in" className="ms-3">
                    <Button variant="outline-primary" size="sm" className="rounded-pill px-3 py-2">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/sign-up" className="ms-2">
                    <Button variant="primary" size="sm" className="rounded-pill px-3 py-2">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      {/* Add spacer to prevent content from hiding under the fixed navbar */}
      <div style={{ height: '70px' }}></div>
    </header>
  );
};

export default Header;