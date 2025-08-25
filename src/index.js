import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/base.css';
import './styles/components.css';
import './styles/effects.css';
import './styles/map.css';
import './styles/panels.css';
import './styles/tooltips.css';
import './components/ReportsView.css';
import './components/map/MovementModal.css';
import './components/map/OtherCityModal.css';
import './components/map/MapOverlay.css';
import './components/city/ResearchQueue.css';
import './components/shared/Notification.css';
import './components/map/Notes.css';
import './components/VipDisplay.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <div className="bg-gray-900 text-white min-h-screen font-sans">
        <App />
      </div>
    </AuthProvider>
  </React.StrictMode>
);
