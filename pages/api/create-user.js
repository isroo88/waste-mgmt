import { createClient } from '@supabase/supabase-js';

// This runs server-side only — the service role key is never exposed to the browser.
// It bypasses RLS and can create auth users without affecting the caller's session.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, full_name, password, role } = req.body;

  if (!username || !full_name || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const email = `${username.trim().toLowerCase()}@wastemgmt.local`;

  // Create the Supabase Auth user using admin privileges
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so no verification email needed
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Insert the app profile row
  const { error: profileError } = await supabaseAdmin.from('app_users').insert({
    id: data.user.id,
    username: username.trim().toLowerCase(),
    full_name,
    role,
    status: 'active',
  });

  if (profileError) {
    // Auth user was created but profile failed — clean up the auth user
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return res.status(400).json({ error: profileError.message });
  }

  return res.status(200).json({ success: true });
}