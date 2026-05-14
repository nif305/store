'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Role = 'manager' | 'warehouse' | 'user';
type Status = 'active' | 'disabled';
export type AppLanguage = 'ar' | 'en';

export type AppUser = {
  id: string;
  employeeId?: string;
  fullName: string;
  email: string;
  mobile?: string;
  extension?: string;
  department?: string;
  jobTitle?: string;
  preferredLanguage?: AppLanguage;
  operationalProject?: string;
  role: Role;
  roles: Role[];
  status: Status;
  avatar?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  mustChangePassword?: boolean;
  canManageTrainerNeeds?: boolean;
};

type LoginResponse = {
  data?: AppUser;
  error?: string;
};

type MeResponse = {
  user?: AppUser | null;
};

type AuthContextType = {
  user: AppUser | null;
  originalUser: AppUser | null;
  allUsers: AppUser[];
  loading: boolean;
  isAuthenticated: boolean;
  canUseRoleSwitch: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
  switchViewRole: (role: Role) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'inventory-auth-user';
const AUTH_ORIGINAL_STORAGE_KEY = 'inventory-auth-original-user';

function normalizeRole(role?: string | null): Role {
  const value = String(role || '').toLowerCase();
  if (value === 'manager') return 'manager';
  if (value === 'warehouse') return 'warehouse';
  return 'user';
}

function normalizeRoles(roles?: unknown, fallbackRole?: string | null): Role[] {
  const rawRoles = Array.isArray(roles)
    ? roles
    : typeof roles === 'string' && roles.trim()
      ? [roles]
      : fallbackRole
        ? [fallbackRole]
        : ['user'];

  const normalized = Array.from(
    new Set(rawRoles.map((role) => normalizeRole(String(role))))
  );

  if (!normalized.includes('user')) {
    normalized.unshift('user');
  }

  return normalized;
}

function normalizeStatus(status?: string | null): Status {
  return String(status || '').toLowerCase() === 'disabled' ? 'disabled' : 'active';
}

function normalizeLanguage(language?: string | null): AppLanguage {
  return String(language || '').toLowerCase() === 'en' ? 'en' : 'ar';
}

function resolvePrimaryRole(roles: Role[], currentRole?: string | null): Role {
  const normalizedCurrent = normalizeRole(currentRole);

  if (roles.includes(normalizedCurrent)) {
    return normalizedCurrent;
  }

  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}

function normalizeUser(user: any): AppUser {
  const roles = normalizeRoles(user?.roles, user?.role);
  const role = resolvePrimaryRole(roles, user?.role);

  return {
    id: user?.id || '',
    employeeId: user?.employeeId || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    extension: user?.extension || '',
    department: user?.department || '',
    jobTitle: user?.jobTitle || '',
    preferredLanguage: normalizeLanguage(user?.preferredLanguage),
    operationalProject: user?.operationalProject || user?.department || '',
    role,
    roles,
    status: normalizeStatus(user?.status),
    avatar: user?.avatar || null,
    createdAt: user?.createdAt || null,
    lastLoginAt: user?.lastLoginAt || null,
    mustChangePassword: !!user?.mustChangePassword,
    canManageTrainerNeeds: !!user?.canManageTrainerNeeds,
  };
}

function saveStoredUser(key: string, user: AppUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify(user));
}

function loadStoredUser(key: string): AppUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function persistActiveRole(role: Role) {
  const response = await fetch('/api/auth/switch-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error || 'تعذر تحديث الدور النشط');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [originalUser, setOriginalUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      const rows = Array.isArray(json?.data) ? json.data.map(normalizeUser) : [];
      setAllUsers(rows);
    } catch {
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const storedUser = loadStoredUser(AUTH_STORAGE_KEY);
      const storedOriginalUser = loadStoredUser(AUTH_ORIGINAL_STORAGE_KEY);

      if (storedUser && mounted) {
        setUser(storedUser);
        setOriginalUser(storedOriginalUser || storedUser);
      }

      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const json: MeResponse = await response.json().catch(() => ({ user: null }));

        if (!mounted) return;

        if (response.ok && json?.user) {
          const normalizedFromApi = normalizeUser(json.user);
          const effectiveCurrentRole =
            storedUser?.role && normalizedFromApi.roles.includes(storedUser.role)
              ? storedUser.role
              : normalizedFromApi.role;

          const effectiveUser: AppUser = {
            ...normalizedFromApi,
            role: effectiveCurrentRole,
          };

          setUser(effectiveUser);
          setOriginalUser(normalizedFromApi);

          saveStoredUser(AUTH_STORAGE_KEY, effectiveUser);
          saveStoredUser(AUTH_ORIGINAL_STORAGE_KEY, normalizedFromApi);
        } else {
          setUser(null);
          setOriginalUser(null);
          saveStoredUser(AUTH_STORAGE_KEY, null);
          saveStoredUser(AUTH_ORIGINAL_STORAGE_KEY, null);
        }
      } catch {
        if (!mounted) return;

        if (!storedUser) {
          setUser(null);
          setOriginalUser(null);
          saveStoredUser(AUTH_STORAGE_KEY, null);
          saveStoredUser(AUTH_ORIGINAL_STORAGE_KEY, null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (user) {
      refreshUsers();
    }
  }, [user, refreshUsers]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const json: LoginResponse = await response.json().catch(() => ({
      error: 'تعذر تسجيل الدخول',
    }));

    if (!response.ok || !json?.data) {
      throw new Error(json?.error || 'تعذر تسجيل الدخول');
    }

    const normalized = normalizeUser(json.data);

    if (normalized.status === 'disabled') {
      throw new Error('الحساب موقوف. يرجى التواصل مع المدير.');
    }

    setUser(normalized);
    setOriginalUser(normalized);
    saveStoredUser(AUTH_STORAGE_KEY, normalized);
    saveStoredUser(AUTH_ORIGINAL_STORAGE_KEY, normalized);
  }, []);

  const logout = useCallback(() => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    }).finally(() => {
      saveStoredUser(AUTH_STORAGE_KEY, null);
      saveStoredUser(AUTH_ORIGINAL_STORAGE_KEY, null);
      setAllUsers([]);
      window.location.replace('/login');
    });
  }, []);

  const switchViewRole = useCallback(
    async (role: Role) => {
      if (!originalUser) return;
      if (!originalUser.roles.includes(role)) return;

      await persistActiveRole(role);

      const nextUser: AppUser = {
        ...originalUser,
        role,
      };

      setUser(nextUser);
      saveStoredUser(AUTH_STORAGE_KEY, nextUser);
    },
    [originalUser]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      originalUser,
      allUsers,
      loading,
      isAuthenticated: !!user,
      canUseRoleSwitch: (originalUser?.roles?.length || 0) > 1,
      login,
      logout,
      refreshUsers,
      switchViewRole,
    }),
    [user, originalUser, allUsers, loading, login, logout, refreshUsers, switchViewRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
