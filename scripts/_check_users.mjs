const S = 'https://abmzjezdvpzyeooqhhsn.supabase.co';
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${S}/auth/v1/admin/users?page=1&per_page=100`, {
  headers: { Authorization: `Bearer ${K}`, apikey: K },
});
const d = await res.json();
const u = d.users || [];
console.log('Total:', u.length);
const reg = u.filter((x) => x.is_anonymous !== true && x.email);
console.log('Registered:', reg.length);
reg.forEach((x) => console.log(' ', x.email, x.id));
