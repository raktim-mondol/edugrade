import axios from 'axios';

// Create axios instance with base URL from environment variable
// In development: Falls back to empty string (uses proxy in package.json)
// In production: Uses REACT_APP_API_URL or REACT_APP_BACKEND_URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method.toUpperCase(), config.baseURL + config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default api;
