const supabaseUrl = "https://atphyjukjgnnbfbnizyx.supabase.co";
const supabaseKey = "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

window.createArraiSupabase = async () => {
  const { client } = await window.arraiAuth;
  return supabase.createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => {
      const claims = await client.getIdTokenClaims();
      if (!claims?.__raw) throw new Error("Your Auth0 session has expired. Please sign in again.");
      return claims.__raw;
    },
  });
};
