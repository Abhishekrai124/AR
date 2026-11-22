const supabaseUrl = "https://atphyjukjgnnbfbnizyx.supabase.co";
const supabaseKey = "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

if (window.supabase) {
  window.arraiSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
}

window.createArraiSupabase = async () => window.arraiSupabase;
window.arraiGetAuthSettings = async () => {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
  if (!response.ok) throw new Error("Supabase sign-in options could not be loaded.");
  return response.json();
};

window.arraiAuth = window.arraiSupabase
  ? window.arraiSupabase.auth.getUser().then(({ data, error }) => {
      if (error || !data?.user) {
        localStorage.removeItem("arrai_current_user");
        return { isAuthenticated: false, user: null };
      }
      const source = data.user;
      const userObj = {
        id: source.id,
        sub: source.id,
        email: source.email,
        name: source.user_metadata?.full_name || source.user_metadata?.name || source.email?.split("@")[0] || "Explorer",
        avatarUrl: source.user_metadata?.avatar_url || source.user_metadata?.picture || "",
      };
      localStorage.setItem("arrai_current_user", JSON.stringify(userObj));
      return {
        isAuthenticated: true,
        user: userObj,
      };
    }).catch(() => ({ isAuthenticated: false, user: null }))
  : Promise.resolve({ isAuthenticated: false, user: null });

window.logout = () =>
  window.arraiSupabase?.auth.signOut({ scope: "local" }).then(() => {
    localStorage.removeItem("arrai_current_user");
    window.location.assign("index.html");
  });
