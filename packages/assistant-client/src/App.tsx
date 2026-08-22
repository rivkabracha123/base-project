import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { SampleLotPage } from './app/SampleLotPage';

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
