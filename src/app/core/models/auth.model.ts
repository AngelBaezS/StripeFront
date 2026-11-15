export type UserRole = 'ADMIN' | 'CLIENT';

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone: string;
  role?: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface AuthResponse {
  token?: string;
  jwt?: string;
  accessToken?: string;
  username?: string;
  email?: string;
  role?: UserRole;
  message?: string;
}

export interface RefreshTokenResponse {
  token: string;
  role: UserRole;
  expiresAt: string;
  refreshed: boolean;
}

export interface UpdateUsernameRequest {
  username: string;
}

export interface UpdateUsernameResponse {
  profile: UserProfileResponse;
  token: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}
