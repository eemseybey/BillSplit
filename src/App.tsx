import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HouseholdProvider } from './context/HouseholdContext';
import { MonthProvider } from './context/MonthContext';
import { AppDataProvider } from './context/AppDataContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Bills from './pages/Bills';
import Tapal from './pages/Tapal';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/tapal" element={<Tapal />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HouseholdProvider>
      <MonthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
              }}
            />
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </AppDataProvider>
      </MonthProvider>
    </HouseholdProvider>
  );
}
