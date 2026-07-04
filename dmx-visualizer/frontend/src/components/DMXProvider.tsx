import React, { useEffect, useRef } from 'react';
import { useDMXStore } from '../store/useDMXStore';

export const DMXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setUniverse, setConnected } = useDMXStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      wsRef.current = new WebSocket('ws://localhost:8080');

      wsRef.current.onopen = () => {
        console.log('Connected to DMX Server');
        setConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'DMX_DATA' && Array.isArray(message.data)) {
            setUniverse(message.data);
          }
        } catch (e) {
          console.error('Error parsing DMX data', e);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Disconnected from DMX Server');
        setConnected(false);
        // Attempt to reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket Error', error);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setUniverse, setConnected]);

  return <>{children}</>;
};
