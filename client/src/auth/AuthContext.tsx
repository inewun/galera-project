import { createContext, useContext, type ReactNode } from 'react';

export interface AuthState {
  enabled: boolean;
  user: null | { id: string; name: string };
}

const AuthContext = createContext<AuthState>({ enabled: false, user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ enabled: false, user: null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * TODO: вход по аккаунту OpenProject (валидация через бэкенд / OP, выдача сессии).
 * Пароли через OP API недоступны — потребуется OAuth / внешняя авторизация.
 */
