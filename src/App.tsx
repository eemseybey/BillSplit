import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HouseholdProvider, useHousehold } from './context/HouseholdContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Bills from './pages/Bills';
import Tapal from './pages/Tapal';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import HouseholdSelect from './pages/HouseholdSelect';

function AppRoutes() {
  const { household } = useHousehold();

  if (!household) {
    return <HouseholdSelect />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/tapal" element={<Tapal />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HouseholdProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </HouseholdProvider>
  );
}
