import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000, // Diperpanjang ke 60 detik untuk mendukung operasional bulk/heavy load
});

// Interceptor - otomatis tambahkan token ke setiap request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor - handle error (misal token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired atau invalid
      console.warn('API 401 (unauthorized) on', error.config?.url, ' — clearing token and redirecting to /login');
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
