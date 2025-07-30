import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, Alert, Badge } from 'react-bootstrap';
import { FiUploadCloud, FiFile, FiX } from 'react-icons/fi';

const FileDropzone = ({ 
  accept, 
  onFileUpload, 
  maxFiles = 1,
  title = 'Drop files here', 
  subtitle = 'or click to browse',
  errorMessage = null 
}) => {
  const [fileRejections, setFileRejections] = useState([]);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    onFileUpload(maxFiles === 1 ? acceptedFiles[0] : acceptedFiles);
    if (rejectedFiles.length > 0) {
      setFileRejections(rejectedFiles);
    } else {
      setFileRejections([]);
    }
  }, [onFileUpload, maxFiles]);

  const removeFile = (file) => {
    // For multiple files
    if (Array.isArray(file)) {
      const updatedFiles = acceptedFiles.filter(f => f !== file);
      onFileUpload(updatedFiles);
    } 
    // For single file, just clear it
    else {
      onFileUpload(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive, acceptedFiles, fileRejections: dropzoneRejections } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    multiple: maxFiles > 1
  });

  return (
    <>
      <div 
        {...getRootProps()} 
        className={`dropzone ${isDragActive ? 'border-primary' : ''}`}
        style={{
          background: isDragActive ? 'rgba(66, 133, 244, 0.05)' : ''
        }}
      >
        <input {...getInputProps()} />
        <div className="text-center py-4">
          <div className="mb-3">
            <div className={`d-inline-flex rounded-circle p-3 ${isDragActive ? 'bg-primary bg-opacity-10' : 'bg-light'}`}>
              <FiUploadCloud size={40} className={`${isDragActive ? 'text-primary' : 'text-secondary'}`} />
            </div>
          </div>
          <h5 className="mb-2">{title}</h5>
          <p className="text-muted mb-1">{subtitle}</p>
          {isDragActive && (
            <p className="text-primary fw-bold mt-2">
              Drop the files here...
            </p>
          )}
          {maxFiles > 1 && (
            <Badge bg="light" text="dark" className="mt-2">
              You can upload up to {maxFiles} files
            </Badge>
          )}
        </div>
      </div>

      {errorMessage && (
        <Alert variant="danger" className="mt-2 d-flex align-items-center">
          <FiX className="me-2 flex-shrink-0" size={18} />
          <div>{errorMessage}</div>
        </Alert>
      )}

      {dropzoneRejections.length > 0 && (
        <Alert variant="warning" className="mt-2">
          <div className="fw-bold mb-2">Some files were rejected:</div>
          <ul className="mb-0 ps-3">
            {dropzoneRejections.map((rejection) => (
              <li key={rejection.file.name}>
                {rejection.file.name} - {rejection.errors[0].message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {acceptedFiles.length > 0 && (
        <Card className="mt-3 border-0 shadow-sm">
          <Card.Header className="bg-light">
            <div className="d-flex align-items-center">
              <div className="me-auto">Selected Files</div>
              <Badge bg="primary" className="ms-2">
                {acceptedFiles.length} {acceptedFiles.length === 1 ? 'file' : 'files'}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <ul className="list-group list-group-flush">
              {acceptedFiles.map((file, index) => (
                <li key={index} className="list-group-item px-0 d-flex align-items-center border-bottom">
                  <div className="me-3">
                    <span className="d-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '40px', height: '40px' }}>
                      <FiFile size={20} className="text-primary" />
                    </span>
                  </div>
                  <div className="flex-grow-1">
                    <div className="fw-medium text-truncate" style={{ maxWidth: '200px' }}>
                      {file.name}
                    </div>
                    <div className="text-muted small">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-light rounded-circle"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file);
                    }}
                    title="Remove file"
                  >
                    <FiX size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}
    </>
  );
};

export default FileDropzone;