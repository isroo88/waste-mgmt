import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // app_users row
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadProfile(authUser) {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !data || data.status === 'deactivated') {
      await supabase.auth.signOut();
      setUser(null);
    } else {
      setUser(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Wrap a page component with this to require login (and optionally a role)
export function withAuth(Component, requiredRole = null) {
  return function ProtectedPage(props) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.replace('/login');
      } else if (!loading && requiredRole && user?.role !== requiredRole) {
        router.replace('/dashboard');
      }
    }, [loading, user]);

    if (loading || !user) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' }}>
          Loading...
        </div>
      );
    }
    if (requiredRole && user.role !== requiredRole) return null;

    return <Component {...props} />;
  };
}
