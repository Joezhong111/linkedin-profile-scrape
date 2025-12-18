// New auth service using custom JWT authentication
import { authClient } from "../lib/auth";

export const isAuthReady = true; // Always ready since we're using our own auth

async function getCurrentUserId(): Promise<string> {
  const user = authClient.getUser();
  if (!user?.id) throw new Error("Not authenticated");
  return user.id;
}

export const signIn = async (email: string, password: string) => {
  return await authClient.signIn(email, password);
};

export const signUp = async (email: string, password: string, fullName?: string) => {
  return await authClient.signUp(email, password, fullName);
};

export const signOut = async () => {
  return await authClient.signOut();
};

export const getSession = () => {
  return authClient.getSession();
};

export const getUser = () => {
  return authClient.getUser();
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  return authClient.onAuthStateChange(callback);
};

