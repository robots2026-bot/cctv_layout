import { useEffect } from 'react';
import { useRealtimeStore } from '../stores/realtimeStore';

export const useRealtimeConnection = () => {
  const { connect, disconnect } = useRealtimeStore((state) => ({
    connect: state.connect,
    disconnect: state.disconnect
  }));

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
};
