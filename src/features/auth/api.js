import { requireSupabase } from "../../lib/supabase";

export async function signInWithPassword(values) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithPassword(values);

  if (error) {
    throw error;
  }
}

export async function signUpWithPassword(values) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        display_name: values.displayName
      }
    }
  });

  if (error) {
    throw error;
  }
}

export async function signInWithGoogle() {
  const supabase = requireSupabase();
  const redirectTo = `${window.location.origin}/inicio`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo
    }
  });

  if (error) {
    throw error;
  }
}

export async function sendPasswordReset(email) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
