import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import App from './App';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CodeAnalysis from './pages/CodeAnalysis';
import Goals from './pages/Goals';
import Insights from './pages/Insights';
import Recommendations from './pages/Recommendations';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Landing page - no layout */}
          <Route path="/" element={<Landing />} />
          
          {/* Auth pages - no layout */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* App layout with sidebar/navbar */}
          <Route element={<App />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/code-analysis" element={<CodeAnalysis />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
