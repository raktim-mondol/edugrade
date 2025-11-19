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

// Variable to store the getToken function from Clerk
let getAuthToken = null;

// Function to configure axios with Clerk authentication
export const configureAuth = (getTokenFn) => {
  getAuthToken = getTokenFn;
};

// Add request interceptor for authentication and debugging
api.interceptors.request.use(
  async (config) => {
    console.log('API Request:', config.method.toUpperCase(), config.baseURL + config.url);

    // Add Clerk authentication token if available
    if (getAuthToken) {
      try {
        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Error getting auth token:', error);
      }
    }

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
