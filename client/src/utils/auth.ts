const AUTH_KEY = 'fool_auth';
const AUTH_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

interface AuthData {
  publicKey: string;
  timestamp: number;
}

export const saveAuth = (publicKey: string) => {
  const authData: AuthData = {
    publicKey,
    timestamp: Date.now()
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
};

export const checkAuth = (): boolean => {
  const authData = localStorage.getItem(AUTH_KEY);
  if (!authData) return false;

  const { timestamp }: AuthData = JSON.parse(authData);
  const isExpired = Date.now() - timestamp > AUTH_EXPIRY;
  
  if (isExpired) {
    localStorage.removeItem(AUTH_KEY);
    return false;
  }

  return true;
};

export const clearAuth = () => {
  localStorage.removeItem(AUTH_KEY);
}; 