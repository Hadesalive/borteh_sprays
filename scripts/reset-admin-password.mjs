import { createClient } from '@supabase/supabase-js';

// Usage: node reset-admin-password.mjs <user-id-or-email-or-phone> <new-password>
const [, , identifier, newPassword] = process.argv;

if (!identifier || !newPassword) {
  console.error('Usage: node reset-admin-password.mjs <user-id|email|phone> <new-password>');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function resolveUserId(identifier) {
  // If it already looks like a UUID, use it directly.
  if (/^[0-9a-f-]{36}$/i.test(identifier)) return identifier;

  // Otherwise page through users and match on email/phone.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email === identifier || u.phone === identifier
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

const userId = await resolveUserId(identifier);
if (!userId) {
  console.error(`No user found matching "${identifier}"`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password: newPassword,
});

if (error) {
  console.error('Failed to update password:', error.message);
  process.exit(1);
}

console.log(`Password updated for user ${data.user.id} (${data.user.email ?? data.user.phone})`);
