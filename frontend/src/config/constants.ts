const defaultUrl = import.meta.env.PROD
  ? window.location.origin
  : '';

export const API_URL = import.meta.env.VITE_API_URL || defaultUrl;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultUrl || window.location.origin;
export const IS_PROD = import.meta.env.VITE_ENV === 'production';
