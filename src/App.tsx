import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router';
import { GroupListView } from '@/views/GroupListView';
import { GroupView } from '@/views/GroupView';
import { EscandalloView } from '@/views/EscandalloView';
import { LavanderiaView } from '@/views/LavanderiaView';
import { ManagerEventView } from '@/views/ManagerEventView';
import { LoginView } from '@/views/LoginView';
import { getSession } from '@/lib/store';

/**
 * Flujo por grupos (enrutado por hash), tras login con código:
 *   #/                        → lista de grupos + crear grupo (manager)
 *   #/g/:gid                  → grupo: eventos, totales, Excel (manager)
 *   #/g/:gid/e/:eid/comida    → escandallo comida/cocina (supervisores)
 *   #/g/:gid/e/:eid/bebida    → escandallo bebida/barra (supervisores)
 *   #/g/:gid/e/:eid/lavanderia → conteo de mantelería (supervisores)
 *   #/g/:gid/e/:eid/manager   → datos del evento (manager)
 */
export default function App() {
  const [session, setSession] = useState(getSession);

  // Salir (o caducar la sesión) se refleja al instante en todas las vistas.
  useEffect(() => {
    const t = setInterval(() => setSession(getSession()), 800);
    return () => clearInterval(t);
  }, []);

  if (!session) {
    return <LoginView onLogin={() => setSession(getSession())} />;
  }

  return (
    <Routes>
      <Route path="/" element={<GroupListView />} />
      <Route path="/g/:gid" element={<GroupView />} />
      <Route path="/g/:gid/e/:eid/comida" element={<EscandalloView kind="comida" />} />
      <Route path="/g/:gid/e/:eid/bebida" element={<EscandalloView kind="bebida" />} />
      <Route path="/g/:gid/e/:eid/lavanderia" element={<LavanderiaView />} />
      <Route path="/g/:gid/e/:eid/manager" element={<ManagerEventView />} />
      <Route path="*" element={<GroupListView />} />
    </Routes>
  );
}