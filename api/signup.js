const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

export default async function handler(request, response) {
  // CORS & headers
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  response.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");

  if (request.method === "OPTIONS") {
    return response.status(200).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, name } = request.body || {};
    if (!email || !password) {
      return response.status(400).json({ error: "Email and password are required." });
    }

    if (password.length < 6) {
      return response.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return response.status(503).json({
        error: "Server configuration missing SUPABASE_SERVICE_ROLE_KEY. Please sign in with Google or disable Bot/Captcha Protection in your Supabase dashboard (Authentication -> Bot Protection)."
      });
    }

    // Call Supabase Admin API to create user bypassing Turnstile/hCaptcha check
    const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true, // Auto-confirm email so user can sign in immediately
        user_metadata: {
          full_name: name ? name.trim() : email.split("@")[0],
          display_name: name ? name.trim() : email.split("@")[0],
        },
      }),
    });

    const data = await adminRes.json();

    if (!adminRes.ok) {
      const msg = data.msg || data.message || data.error_description || "Account creation failed.";
      return response.status(adminRes.status).json({ error: msg });
    }

    const user = data;

    // Ensure profile row exists in profiles table
    if (user && user.id) {
      try {
        const username = (name || email.split("@")[0])
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .slice(0, 24) + "_" + Math.floor(1000 + Math.random() * 9000);

        await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: user.id,
            display_name: name ? name.trim() : email.split("@")[0],
            username,
            email: email.trim().toLowerCase(),
            created_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.warn("Could not upsert profile:", e);
      }
    }

    return response.status(200).json({
      ok: true,
      user: { id: user.id, email: user.email },
      message: "Account created successfully! Signing in…",
    });
  } catch (err) {
    console.error("Signup handler error:", err);
    return response.status(500).json({ error: err.message || "Internal server error" });
  }
}
