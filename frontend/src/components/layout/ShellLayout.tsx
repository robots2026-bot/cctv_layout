import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { useUIStore } from '../../stores/uiStore';

const ShellLayout = ({ children }: PropsWithChildren) => {
  const connectionState = useRealtimeStore((state) => state.connectionState);
  const notifications = useUIStore((state) => state.notifications);

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <Link to="/projects" className="text-xl font-semibold text-white">
          CCTV 布局平台
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <span>
            实时连接：
            <span
              className={
                connectionState === 'connected'
                  ? 'text-emerald-400'
                  : connectionState === 'connecting'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {connectionState}
            </span>
          </span>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden">{children}</div>
        <aside className="w-80 border-l border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">通知</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            {notifications.length === 0 && <li>暂无通知</li>}
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded border border-slate-800/80 bg-slate-900/60 p-2">
                <div className="font-medium text-slate-200">{notification.title}</div>
                <div>{notification.message}</div>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
};

export default ShellLayout;
