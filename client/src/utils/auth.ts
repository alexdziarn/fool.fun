const AUTH_KEY = 'fool_auth';
const AUTH_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

interface AuthData {
  publicKey: string;
  timestamp: number;
  lastConnected: number;
}

export const saveAuth = (publicKey: string) => {
  const authData: AuthData = {
    publicKey,
    timestamp: Date.now(),
    lastConnected: Date.now()
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
};

export const updateLastConnected = (publicKey: string) => {
  const authData = localStorage.getItem(AUTH_KEY);
  if (authData) {
    const data: AuthData = JSON.parse(authData);
    data.lastConnected = Date.now();
    if (publicKey) {
      data.publicKey = publicKey;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  }
};

export const getStoredPublicKey = (): string | null => {
  const authData = localStorage.getItem(AUTH_KEY);
  if (!authData) return null;

  try {
    const { publicKey }: AuthData = JSON.parse(authData);
    return publicKey;
  } catch (error) {
    console.error('Error parsing stored auth data:', error);
    return null;
  }
};

export const checkAuth = (): boolean => {
  const authData = localStorage.getItem(AUTH_KEY);
  if (!authData) return false;

  try {
    const { timestamp }: AuthData = JSON.parse(authData);
    const isExpired = Date.now() - timestamp > AUTH_EXPIRY;
    
    if (isExpired) {
      localStorage.removeItem(AUTH_KEY);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking auth:', error);
    localStorage.removeItem(AUTH_KEY);
    return false;
  }
};

export const clearAuth = () => {
  localStorage.removeItem(AUTH_KEY);
}; 