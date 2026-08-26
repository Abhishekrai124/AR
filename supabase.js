const supabaseUrl = "https://atphyjukjgnnbfbnizyx.supabase.co";
const supabaseKey = "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

window.arraiSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
window.createArraiSupabase = async () => window.arraiSupabase;
window.arraiAuth = window.arraiSupabase.auth.getUser().then(({ data, error }) => {
  if (error || !data.user) return { isAuthenticated: false, user: null };
  const source = data.user;
  return {
    isAuthenticated: true,
    user: {
      id: source.id,
      sub: source.id,
      email: source.email,
      name: source.user_metadata.full_name || source.user_metadata.name || source.email.split("@")[0],
      avatarUrl: source.user_metadata.avatar_url || source.user_metadata.picture || "",
    },
  };
});
window.logout = () => window.arraiSupabase.auth.signOut({ scope: "local" }).then(() => window.location.assign("index.html"));
