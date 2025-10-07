import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LayoutWorkbench from './pages/LayoutWorkbench';
import ProjectOverview from './pages/ProjectOverview';
import ShellLayout from './components/layout/ShellLayout';
import { useRealtimeConnection } from './hooks/useRealtimeConnection';

const App = () => {
  useRealtimeConnection();

  return (
    <ShellLayout>
      <Suspense fallback={<div className="flex h-full items-center justify-center">加载中...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectOverview />} />
          <Route path="/projects/:projectId/layouts/:layoutId" element={<LayoutWorkbench />} />
        </Routes>
      </Suspense>
    </ShellLayout>
  );
};

export default App;
