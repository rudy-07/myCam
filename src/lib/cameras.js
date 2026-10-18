/** The backend can relay one camera; its id is "mobile". Other ids are shown as stored. */
export const BROADCASTER_ID = 'mobile';
export const BROADCASTER_LABEL = 'CAM-01 (Mobile Broadcaster)';

export const cameraLabel = (id) => (id === BROADCASTER_ID ? BROADCASTER_LABEL : (id || 'Unknown camera'));
