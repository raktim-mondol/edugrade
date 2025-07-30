import React from 'react';
import PropTypes from 'prop-types';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@material-ui/core';

const SubmissionTable = ({ submissions }) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Submission ID</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Score</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {submissions.map((submission) => (
          <TableRow key={submission.id}>
            <TableCell>{submission.id}</TableCell>
            <TableCell>{submission.status}</TableCell>
            <TableCell>
              {submission.status === 'completed' ? (
                submission.totalPossible ? (
                  `${submission.score} / ${submission.totalPossible}`
                ) : (
                  submission.score
                )
              ) : (
                submission.status
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

SubmissionTable.propTypes = {
  submissions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      score: PropTypes.number,
      totalPossible: PropTypes.number,
    })
  ).isRequired,
};

export default SubmissionTable;