# Assignment Evaluation System Rules and Guidelines

## Project Overview
This web application allows instructors to automate the evaluation of student assignments using LLM (Large Language Model) APIs. The system streamlines the grading process by analyzing student submissions against predefined solutions and marking rubrics.

## Core Features

### 1. Upload System
- **Assignment Upload**: Instructors can upload assignment details, including instructions and expected deliverables.
- **Solution Upload**: Instructors can upload model solutions for reference.
- **Rubric Upload**: Marking rubrics with evaluation criteria and point distribution.
- **Student Submission Upload**: 
  - Individual submission upload
  - Batch submission upload (multiple files in ZIP/folder)

### 2. Evaluation Engine
- Integration with various LLM APIs (e.g., OpenAI, Anthropic, Google Gemini)
- Automatic comparison between student submissions and model solutions
- Evaluation based on the uploaded marking rubric
- Detailed feedback generation for each submission

### 3. Results Management
- Individual student results with ID and marks
- Batch processing results
- Downloadable results in Excel format
- Visualization of class performance

## Technical Architecture

### Frontend (Client)
- React-based single-page application
- File upload components with drag-and-drop functionality
- Results dashboard with filtering and sorting options
- Excel export functionality

### Backend (Server)
- Node.js with Express framework
- RESTful API endpoints for file uploads and processing
- LLM API integration layer
- Authentication and user management
- File storage and management
- Results processing and Excel generation

### Database
- MongoDB for storing:
  - User information
  - Assignment details
  - Rubrics
  - Submission metadata
  - Evaluation results

## Workflow

1. **Setup Phase**
   - Instructor logs in
   - Uploads assignment details
   - Uploads solution
   - Creates or uploads marking rubric

2. **Submission Phase**
   - Instructor uploads student submissions (single or batch)
   - System validates file formats and prepares for processing

3. **Evaluation Phase**
   - System sends submissions to appropriate LLM API
   - LLMs analyze submissions against solution and rubric
   - System processes and stores evaluation results

4. **Results Phase**
   - System displays evaluation results with student IDs and marks
   - Instructor can review and adjust marks if necessary
   - Results can be exported to Excel

## LLM API Integration

The system will support multiple LLM providers to ensure flexibility and optimal performance:

- **OpenAI (GPT-4/GPT-3.5)**: Primary evaluation engine
- **Anthropic Claude**: Alternative for complex assignments
- **Google Gemini**: Additional option for specific use cases

Each API will be configured with specific prompts and parameters to ensure accurate evaluation based on:
- Assignment requirements
- Solution patterns
- Rubric criteria

## Security and Privacy Considerations

- All student data will be encrypted at rest and in transit
- Student submissions will be anonymized before LLM processing when possible
- Results will be accessible only to authorized instructors
- Data retention policies will be implemented for student submissions

## Development Roadmap

1. **Phase 1**: Basic upload functionality and UI implementation
2. **Phase 2**: LLM API integration and evaluation engine
3. **Phase 3**: Results processing and Excel export
4. **Phase 4**: Performance optimization and additional features

## Extensions and Future Features

- Plagiarism detection
- Historical performance tracking
- Advanced analytics and insights
- Peer review functionality
- Student feedback portal

## Terminal is powershell not cmd. Run the code accordingly.