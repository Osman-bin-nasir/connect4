import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GamePage from './pages/GamePage';
import './App.css';

import { useNavigate } from 'react-router-dom';
import setupAxios from './axiosSetup';

// Inner component to use useNavigate
function AxiosInterceptor() {
  const navigate = useNavigate();
  // Using useState to ensure it runs only once is cleaner, but useEffect is standard
  React.useEffect(() => {
    setupAxios(navigate);
  }, [navigate]);
  return null;
}

function App() {
  return (
    <Router>
      <AxiosInterceptor />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff'
            }
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/game/:gameId" element={<GamePage />} />
      </Routes>
    </Router>
  );
}

export default App;
