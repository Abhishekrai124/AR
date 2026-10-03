const supabaseUrl = "https://atphyjukjgnnbfbnizyx.supabase.co";
const supabaseKey = "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

window.arraiSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
window.createArraiSupabase = async () => window.arraiSupabase;

const normalizeArraiUser = (source) => {
  if (!source?.id) return null;
  const metadata = source.user_metadata || {};
  return {
    id: source.id,
    sub: source.id,
    email: source.email || "",
    name: metadata.full_name || metadata.name || source.email?.split("@")[0] || "Arrai member",
    avatarUrl: metadata.avatar_url || metadata.picture || "",
  };
};

// The Auth UUID is the only identity key shared by ARRAI.in and ARRAI Pay.
// This RPC is idempotent and never matches accounts by email, phone, or handle.
window.ensureArraiProfile = async () => {
  const { data, error } = await window.arraiSupabase.rpc("arrai_wallet_profile_ensure");
  if (error) {
    const schemaUnavailable = /function|schema|does not exist|not found/i.test(error.message || "");
    if (schemaUnavailable) return { profile: null, unavailable: true };
    throw error;
  }
  return { profile: data, unavailable: false };
};

window.getArraiSession = async () => {
  const { data, error } = await window.arraiSupabase.auth.getUser();
  if (error || !data.user) return { isAuthenticated: false, user: null, profile: null, profileUnavailable: false };
  const profileState = await window.ensureArraiProfile();
  return {
    isAuthenticated: true,
    user: normalizeArraiUser(data.user),
    profile: profileState.profile,
    profileUnavailable: profileState.unavailable,
  };
};
window.arraiAuth = window.getArraiSession();
window.arraiSupabase.auth.onAuthStateChange((event, session) => {
  window.arraiAuth = window.getArraiSession();
  if ((event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") && !session) {
    window.location.assign("auth.html");
  }
});
window.logout = async () => {
  await window.arraiSupabase.auth.signOut({ scope: "local" });
  window.location.assign("index.html");
};
