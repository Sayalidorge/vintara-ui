// Automatically detect the environment based on the browser's current URL
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'
);

// Set the base URL dynamically
const BASE_URL = isLocalhost 
  ? 'http://localhost:8080'         // Local Spring Boot URL
  : 'https://app.vintarastays.in';     // Production Spring Boot URL

export default {
  BASE_URL,
  API_BASE_URL: BASE_URL, // Alias so components using API_BASE_URL don't break

  // Dynamic Auth Header Helper
  getHeaders: () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : "",
    };
  }
};