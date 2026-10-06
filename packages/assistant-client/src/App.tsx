import { Navigate, Route, Routes } from 'react-router-dom';
import { LotPage } from './app/LotPage';
import { SampleLotPage } from './app/SampleLotPage';
import { ChatPage } from './chat/ChatPage';
import { AppHeader } from './components/AppHeader';
import { ResultsPage } from './components/ResultPage';

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/lots/:id" element={<LotPage />} />
        <Route path="/chat/:role" element={<ChatPage />} />
        <Route path="/chat" element={<Navigate to="/chat/buyer" replace />} />
        <Route path="*" element={<Navigate to="/results" replace />} />
      </Routes>
    </>
  );
}
