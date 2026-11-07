/** User object returned from API */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/** Available user roles */
export type UserRole = "admin" | "operator" | "viewer";

/** Login request payload */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Registration request payload */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Auth response from API */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/** Auth state in store */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
