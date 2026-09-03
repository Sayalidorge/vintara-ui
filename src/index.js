import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './css/global.css';
import './services/httpInterceptor';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

