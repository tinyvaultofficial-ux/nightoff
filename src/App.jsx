import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ClientList from './pages/ClientList.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import ClientForm from './pages/ClientForm.jsx';
import ConversationPage from './pages/ConversationPage.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ClientList />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/conversations/:id" element={<ConversationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
