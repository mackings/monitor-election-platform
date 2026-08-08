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

export interface BulkOfficerRowResult {
  row: number;
  name: string;
  success: boolean;
  username?: string;
  password?: string;
  error?: string;
}

/** Each row goes through the exact same CreateOfficer path a manual add
 * would use -- a bad row (typo'd PU code, missing name) reports its own
 * error without sinking the rest of the batch. */
export function bulkCreateOfficers(rows: CreateOfficerInput[]) {
  return api.post<{ results: BulkOfficerRowResult[] }>("/api/v1/officers/bulk", { rows });
}

export interface QuickAssignResult {
  username: string;
  password: string;
}

/** Bulk-creates `count` field officer accounts sharing one admin-typed
 * password, all with no polling unit assigned on purpose -- agents pick
 * their own the first time they open the field app (see the "self-assign"
 * PU picker) instead of an admin hand-assigning each one. */
export function quickAssignOfficers(count: number, password: string) {
  return api.post<{ results: QuickAssignResult[] }>("/api/v1/officers/quick-assign", { count, password });
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
