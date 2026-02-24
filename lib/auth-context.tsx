"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  win_streak: number;
  total_battles: number;
  xp_total: number;
  daily_debate_count: number;
  last_debate_date: string | null;
  streak_count: number;
  strike_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithFacebook: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url">>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

async function createProfile(userId: string, username: string, displayName: string): Promise<Profile | null> {
  // The auto-trigger may have already created a profile — check first
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    // Trigger created it — update with the username/display_name the user chose
    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({ username, display_name: displayName })
      .eq("id", userId)
      .select()
      .single();
    if (updated && !updateErr) return updated as Profile;
    return existing as Profile; // Return existing even if update fails
  }

  // No existing profile — insert fresh
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username,
      display_name: displayName,
      elo_rating: 1000,
      wins: 0,
      losses: 0,
      win_streak: 0,
      total_battles: 0,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(u.id);
    setProfile(p);
  }, []);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null).finally(() => setLoading(false));
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string, displayName: string) => {
    // Check username availability
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (existing) return { error: "Username already taken" };

    // Pass username in metadata so the trigger uses it
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase(), display_name: displayName },
      },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Sign up failed" };

    // Try to set profile right away (works if email confirm is off)
    const p = await createProfile(data.user.id, username.toLowerCase(), displayName);
    if (p) setProfile(p);

    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      let p = await fetchProfile(data.user.id);
      // If profile has generic name, fix it from user metadata
      if (p && p.username.startsWith("user_") && data.user.user_metadata?.username) {
        const uname = data.user.user_metadata.username;
        await supabase.from("profiles").update({
          username: uname,
          display_name: uname,
        }).eq("id", data.user.id);
        p = await fetchProfile(data.user.id);
      }
      setProfile(p);
    }
    return { error: null };
  }, []);

  const signInWithFacebook = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url">>) => {
    if (!user) return { error: "Not signed in" };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error) return { error: error.message };
    setProfile(prev => prev ? { ...prev, ...updates } : null);
    return { error: null };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signInWithFacebook, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
