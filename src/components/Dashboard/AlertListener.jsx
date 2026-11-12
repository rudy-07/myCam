import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../../config';
import { getAuthToken } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Single dashboard-wide subscription to the server's real "smart-alert" events.
 * Mounted once; the socket and handler are removed on unmount so alerts are
 * neither duplicated nor leaked.
 */
const AlertListener = () => {
  const { addToast } = useToast();
  const { pushEvent, preferences } = useNotifications();
  const handlersRef = useRef({ addToast, pushEvent, preferences });

  useEffect(() => { handlersRef.current = { addToast, pushEvent, preferences }; }, [addToast, pushEvent, preferences]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAuthToken() } });

    const onAlert = (data) => {
      const message = data?.message || 'Activity reported by a camera';
      const timestamp = data?.timestamp || new Date().toISOString();
      handlersRef.current.pushEvent({ id: data?.id, type: data?.type || 'alert', cameraId: data?.cameraId, message, timestamp, isRead: false });
      if (data?.dashboardToast !== false && handlersRef.current.preferences.dashboardToasts) {
        handlersRef.current.addToast(message, data?.type === 'motion' ? 'warning' : 'info', 4500);
      }

      if (handlersRef.current.preferences.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('myCam Security Alert', { body: message, icon: '/mycam_logo.svg' });
        } catch {
          /* ignore */
        }
      }
    };

    socket.on('smart-alert', onAlert);

    return () => {
      socket.off('smart-alert', onAlert);
      socket.disconnect();
    };
  }, []);


  return null;
};

export default AlertListener;
