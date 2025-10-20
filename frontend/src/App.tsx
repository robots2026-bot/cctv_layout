import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LayoutWorkbench from './pages/LayoutWorkbench';
import ProjectManagement from './pages/ProjectManagement';
import ShellLayout from './components/layout/ShellLayout';
import { useRealtimeConnection } from './hooks/useRealtimeConnection';
import WorkbenchRedirect from './pages/WorkbenchRedirect';
import ProjectWithoutLayout from './pages/ProjectWithoutLayout';
import GatewayMock from './pages/GatewayMock';

const App = () => {
  useRealtimeConnection();

  return (
    <ShellLayout>
      <Suspense fallback={<div className="flex h-full items-center justify-center">加载中...</div>}>
        <Routes>
          <Route path="/" element={<WorkbenchRedirect />} />
          <Route path="/projects/manage" element={<ProjectManagement />} />
          <Route path="/projects/:projectId" element={<ProjectWithoutLayout />} />
          <Route path="/projects/:projectId/layouts/:layoutId" element={<LayoutWorkbench />} />
          <Route path="/device-sync/mock" element={<GatewayMock />} />
        </Routes>
      </Suspense>
    </ShellLayout>
  );
};

export default App;
