import { supabase } from '../supabase';

export const authService = {
  async signInWithGoogle() {
    return await supabase.auth.signInWithOAuth({ provider: 'google' });
  },

  async signInAnonymously() {
    return await supabase.auth.signInAnonymously();
  },

  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string, metadata: any) {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
  },
};
