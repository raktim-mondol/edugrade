import React from 'react';
import { Table, Button, Badge, Spinner } from 'react-bootstrap';
import { FiTrash2, FiClock, FiCheckCircle, FiAlertCircle, FiArrowUp, FiArrowDown } from 'react-icons/fi';

const SubmissionTableComponent = ({
  submissions,
  onDeleteClick,
  getStatusBadge,
  renderScore,
  getSortIcon,
  handleSort,
  updatingSubmissionIds,
  assignment // Added assignment prop
}) => {
  
  // Determine if question columns are needed
  const hasQuestionScores = submissions.some(sub => 
    sub.evaluationResult && 
    sub.evaluationResult.questionScores && 
    sub.evaluationResult.questionScores.length > 0
  );

  // Extract unique question numbers if they exist
  const questionNumbers = [];
  if (hasQuestionScores) {
    const questionSet = new Set();
    submissions.forEach(sub => {
      if (sub.evaluationResult && sub.evaluationResult.questionScores) {
        sub.evaluationResult.questionScores.forEach(q => questionSet.add(q.questionNumber));
      }
    });
    questionNumbers.push(...questionSet);
    questionNumbers.sort((a, b) => a - b); // Sort numerically
  }

  return (
    <div className="table-responsive">
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th 
              onClick={() => handleSort('studentId')} 
              style={{ cursor: 'pointer', minWidth: '150px' }}
              className="text-nowrap"
            >
              Student ID {getSortIcon('studentId')}
            </th>
            <th 
              onClick={() => handleSort('studentName')} 
              style={{ cursor: 'pointer', minWidth: '150px' }}
              className="text-nowrap"
            >
              Student Name {getSortIcon('studentName')}
            </th>
            <th 
              onClick={() => handleSort('status')} 
              style={{ cursor: 'pointer', minWidth: '120px' }}
              className="text-nowrap"
            >
              Status {getSortIcon('status')}
            </th>
            <th 
              onClick={() => handleSort('score')} 
              style={{ cursor: 'pointer', minWidth: '100px' }}
              className="text-nowrap text-end"
            >
              Score {getSortIcon('score')}
            </th>
            {/* Dynamically add question score columns */}
            {questionNumbers.map(qNum => (
              <th 
                key={`q${qNum}-header`}
                onClick={() => handleSort(`q${qNum}Score`)}
                style={{ cursor: 'pointer', minWidth: '80px' }}
                className="text-nowrap text-end"
              >
                Q{qNum} {getSortIcon(`q${qNum}Score`)}
              </th>
            ))}
            <th style={{ minWidth: '200px' }}>Feedback Snippet</th>
            <th 
              onClick={() => handleSort('submitDate')} 
              style={{ cursor: 'pointer', minWidth: '150px' }}
              className="text-nowrap"
            >
              Submitted {getSortIcon('submitDate')}
            </th>
            <th 
              onClick={() => handleSort('evaluationCompletedAt')} 
              style={{ cursor: 'pointer', minWidth: '150px' }}
              className="text-nowrap"
            >
              Evaluated {getSortIcon('evaluationCompletedAt')}
            </th>
            <th style={{ minWidth: '80px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.length > 0 ? (
            submissions.map((submission) => (
              <tr 
                key={submission._id} 
                className={submission.justUpdated ? 'highlight-updated-row' : ''}
                style={updatingSubmissionIds.includes(submission._id) ? 
                  { backgroundColor: 'rgba(255, 250, 205, 0.4)' } : {}
                }
              >
                <td><strong>{submission.studentId || '-'}</strong></td>
                <td>{submission.studentName || '-'}</td>
                <td>{getStatusBadge(submission.status)}</td>
                <td className={`text-end ${submission.justUpdated ? 'highlight-score-cell' : ''}`}>
                  {renderScore(submission)}
                </td>
                {/* Dynamically add question score cells */}
                {questionNumbers.map(qNum => {
                  const questionScore = submission.evaluationResult?.questionScores?.find(q => q.questionNumber === qNum);
                  const scoreValue = questionScore ? Number(questionScore.score).toFixed(1) : '-';
                  const maxScoreValue = questionScore ? ` / ${Number(questionScore.maxScore).toFixed(1)}` : '';
                  return (
                    <td key={`q${qNum}-cell-${submission._id}`} className="text-end">
                      {scoreValue}{maxScoreValue}
                    </td>
                  );
                })}
                <td>
                  {submission.evaluationStatus === 'completed' && submission.evaluationResult ? (
                    <div className="small text-muted" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {submission.evaluationResult.strengths && submission.evaluationResult.strengths.length > 0 && (
                        <span title={submission.evaluationResult.strengths.join('; ')}>
                          <Badge bg="success" className="me-1 opacity-75">✓</Badge> {submission.evaluationResult.strengths[0]}
                        </span>
                      )}
                      {submission.evaluationResult.areasForImprovement && submission.evaluationResult.areasForImprovement.length > 0 && (
                        <span title={submission.evaluationResult.areasForImprovement.join('; ')} className="d-block mt-1">
                          <Badge bg="warning" text="dark" className="me-1 opacity-75">!</Badge> {submission.evaluationResult.areasForImprovement[0]}
                        </span>
                      )}
                    </div>
                  ) : submission.status === 'failed' && submission.evaluationError ? (
                     <div className="small text-danger" title={submission.evaluationError}>
                       Evaluation Error
                     </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {submission.submitDate ? (
                    <div className="small">
                      <div>{new Date(submission.submitDate).toLocaleDateString()}</div>
                      <div className="text-muted">{new Date(submission.submitDate).toLocaleTimeString()}</div>
                    </div>
                  ) : '-'}
                </td>
                <td>
                  {submission.evaluationCompletedAt ? (
                    <div className="small">
                      <div>{new Date(submission.evaluationCompletedAt).toLocaleDateString()}</div>
                      <div className="text-muted">{new Date(submission.evaluationCompletedAt).toLocaleTimeString()}</div>
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '30px', height: '30px' }}
                    onClick={() => onDeleteClick(submission)}
                    title="Delete Submission"
                  >
                    <FiTrash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8 + questionNumbers.length} className="text-center py-4">
                <p className="mb-0 text-muted">No submissions match your search criteria or filters.</p>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default SubmissionTableComponent;

