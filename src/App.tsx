import { Route, Routes } from 'react-router';
import { SupervisorView } from '@/views/SupervisorView';
import { ManagerView } from '@/views/ManagerView';

/**
 * Dos vistas en la misma app (enrutado por hash):
 *   #/            → supervisor: grupo + consumición + envío a Telegram
 *   #/manager?d=… → manager: datos precargados desde el botón del mensaje
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SupervisorView />} />
      <Route path="/manager" element={<ManagerView />} />
      <Route path="*" element={<SupervisorView />} />
    </Routes>
  );
}
