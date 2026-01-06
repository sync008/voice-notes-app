// API base URL - works for both local and production
export const API_BASE_URL = import.meta.env.PROD 
  ? '' // In production, use relative URLs (same domain)
  : 'http://localhost:5000'; // In development, use backend server