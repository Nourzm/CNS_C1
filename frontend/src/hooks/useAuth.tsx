import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isTeacher: boolean | null;   // null = still checking
  blockedReason: string | null; // set when signed out because not a teacher
  clearBlockedReason: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession]             = useState<Session | null>(null);
  const [user, setUser]                   = useState<User | null>(null);
  const [loading, setLoading]             = useState(true);
  const [isTeacher, setIsTeacher]         = useState<boolean | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  // Check by EMAIL (most teachers have auth_user_id = null in the DB).
  // On success also links auth_user_id so DB functions work going forward.
  const checkTeacher = async (authUser: User) => {
    const { data } = await supabase
      .from("teachers")
      .select("id, auth_user_id")
      .eq("email", authUser.email!)
      .maybeSingle();

    if (!data) {
      // Not in teachers table — kick them out immediately.
      setIsTeacher(false);
      setBlockedReason(
        "Your email is not registered as a teacher. Please contact the administration."
      );
      await supabase.auth.signOut();
      return;
    }

    // Link auth_user_id the first time so DB RLS functions work.
    if (!data.auth_user_id) {
      await supabase
        .from("teachers")
        .update({ auth_user_id: authUser.id })
        .eq("id", data.id);
    }

    setIsTeacher(true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkTeacher(session.user);
      } else {
        setIsTeacher(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkTeacher(session.user);
        } else {
          setIsTeacher(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsTeacher(null);
  };

  const clearBlockedReason = () => setBlockedReason(null);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, isTeacher, blockedReason, clearBlockedReason, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
