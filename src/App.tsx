import { Route, Routes } from 'react-router';
import { GroupListView } from '@/views/GroupListView';
import { GroupView } from '@/views/GroupView';
import { EscandalloView } from '@/views/EscandalloView';
import { ManagerEventView } from '@/views/ManagerEventView';

/**
 * Flujo por grupos (enrutado por hash):
 *   #/                        → lista de grupos + crear grupo (manager)
 *   #/g/:gid                  → grupo: eventos, totales, Excel (manager)
 *   #/g/:gid/e/:eid/comida    → escandallo comida/cocina (supervisores)
 *   #/g/:gid/e/:eid/bebida    → escandallo bebida/barra (supervisores)
 *   #/g/:gid/e/:eid/manager   → datos del evento (manager, con PIN)
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupListView />} />
      <Route path="/g/:gid" element={<GroupView />} />
      <Route path="/g/:gid/e/:eid/:kind" element={<EscandalloView />} />
      <Route path="/g/:gid/e/:eid/manager" element={<ManagerEventView />} />
      <Route path="*" element={<GroupListView />} />
    </Routes>
  );
}
