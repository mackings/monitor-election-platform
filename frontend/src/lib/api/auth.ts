import { api } from "./client";
import type { User } from "@/types";

export interface LoginResult {
  token: string;
  user: User;
}

export function login(username: string, password: string) {
  return api.post<LoginResult>("/api/v1/auth/login", { username, password });
}

export interface SignupInput {
  name: string;
  phone: string;
  email?: string;
  username: string;
  password: string;
}

// Public self-registration — always creates a field_officer account.
// Returns the same shape as login() so the caller can reuse setSession.
export function signup(input: SignupInput) {
  return api.post<LoginResult>("/api/v1/auth/signup", input);
}

export interface CreateOfficerInput {
  name: string;
  phone: string;
  email?: string;
  role?: "field_officer" | "supervisor" | "admin";
  assigned_pu_code?: string;
}

export interface CreateOfficerResult {
  User: User;
  Username: string;
  Password: string;
  EmailSent: boolean;
}

export function createOfficer(input: CreateOfficerInput) {
  return api.post<CreateOfficerResult>("/api/v1/officers", input);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api.post<{ status: string }>("/api/v1/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export function listAdmins() {
  return api.get<User[]>("/api/v1/admins");
}

// Always resolves — the endpoint intentionally reports the same generic
// status regardless of whether a matching account was found.
export function forgotPassword(usernameOrEmail: string) {
  return api.post<{ status: string }>("/api/v1/auth/forgot-password", {
    username_or_email: usernameOrEmail,
  });
}

export function resetPassword(token: string, newPassword: string) {
  return api.post<{ status: string }>("/api/v1/auth/reset-password", {
    token,
    new_password: newPassword,
  });
}
