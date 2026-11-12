import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CAMERA_STATUS, summarizeStatuses } from '../lib/cameraStatus';

/**
 * Shares the real connection status reported by <CameraFeed /> so the
 * top bar can summarise it. Nothing is assumed: if no feed has reported
 * a status, the summary says so.
 */
const CameraStatusContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useCameraStatus = () => {
  const ctx = useContext(CameraStatusContext);
  if (!ctx) throw new Error('useCameraStatus must be used within a CameraStatusProvider');
  return ctx;
};

export const CameraStatusProvider = ({ children }) => {
  const [statuses, setStatuses] = useState({});

  const reportStatus = useCallback((key, status) => {
    setStatuses((prev) => (prev[key] === status ? prev : { ...prev, [key]: status }));
  }, []);

  const clearStatus = useCallback((key) => {
    setStatuses((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const summary = summarizeStatuses(Object.values(statuses));
    return { statuses, reportStatus, clearStatus, summary };
  }, [statuses, reportStatus, clearStatus]);

  return <CameraStatusContext.Provider value={value}>{children}</CameraStatusContext.Provider>;
};

export { CAMERA_STATUS };
