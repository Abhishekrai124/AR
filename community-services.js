(() => {
  const pending = (service, feature) =>
    new Error(`${service}: ${feature} is pending provider integration.`);

  class CommunityService {
    constructor(client) {
      this.db = client;
    }

    async discover(query = "") {
      let request = this.db
        .from("communities")
        .select("id,slug,name,description,visibility,created_by,created_at")
        .eq("visibility", "public")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(24);
      const search = query.trim();
      if (search) {
        const term = search.replace(/[%_,().]/g, " ").trim();
        if (term) request = request.ilike("name", `%${term}%`);
      }
      const { data, error } = await request;
      if (error) throw error;
      return data || [];
    }

    async mine(userId) {
      const { data: memberships, error } = await this.db
        .from("community_memberships")
        .select("community_id,role,status,joined_at")
        .eq("user_id", userId)
        .neq("status", "banned")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      const ids = (memberships || []).map((membership) => membership.community_id);
      if (!ids.length) return [];
      const { data: communities, error: communityError } = await this.db
        .from("communities")
        .select("id,slug,name,description,visibility,created_by,created_at")
        .in("id", ids)
        .is("archived_at", null);
      if (communityError) throw communityError;
      const roles = new Map(
        memberships.map((membership) => [
          membership.community_id,
          { role: membership.role, status: membership.status },
        ]),
      );
      return (communities || []).map((community) => ({
        ...community,
        ...roles.get(community.id),
      }));
    }

    async create({ name, slug, description }) {
      const { data, error } = await this.db.rpc("arrai_community_create", {
        p_name: name,
        p_slug: slug,
        p_description: description,
      });
      if (error) throw error;
      return data;
    }

    async join(communityId) {
      const { data, error } = await this.db.rpc("arrai_community_join", {
        p_community: communityId,
      });
      if (error) throw error;
      return data;
    }

    async leave(communityId) {
      const { data, error } = await this.db.rpc("arrai_community_leave", {
        p_community: communityId,
      });
      if (error) throw error;
      return data;
    }

    async channels(communityId) {
      const { data, error } = await this.db
        .from("community_channels")
        .select("id,community_id,name,description,channel_type,visibility,slow_mode_seconds,replies_enabled,created_by,created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      return data || [];
    }

    async createChannel(communityId, { name, type, description }) {
      const { data, error } = await this.db.rpc(
        "arrai_community_create_channel",
        {
          p_community: communityId,
          p_name: name,
          p_channel_type: type,
          p_visibility: "community",
          p_description: description,
          p_slow_mode_seconds: 0,
          p_replies_enabled: true,
        },
      );
      if (error) throw error;
      return data;
    }

    async messages(channelId, from = 0, pageSize = 40) {
      const { data, error } = await this.db
        .from("channel_messages")
        .select("id,channel_id,author_id,reply_to,body,edited_at,created_at,profiles!channel_messages_author_id_fkey(username,display_name,avatar_url)")
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return (data || []).reverse();
    }

    async sendMessage(channelId, body, replyTo = null) {
      const { data, error } = await this.db.rpc(
        "arrai_community_send_message",
        { p_channel: channelId, p_body: body, p_reply_to: replyTo },
      );
      if (error) throw error;
      return data;
    }

    subscribe(channelId, onMessage) {
      return this.db
        .channel(`community-channel:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "channel_messages",
            filter: `channel_id=eq.${channelId}`,
          },
          (event) => onMessage(event.new),
        )
        .subscribe();
    }
  }

  class NotificationService {
    constructor(client) {
      this.db = client;
    }

    async list(userId, limit = 30) {
      const { data, error } = await this.db
        .from("user_notifications")
        .select("id,actor_id,kind,object_type,object_id,payload,read_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 50));
      if (error) throw error;
      return data || [];
    }

    async markRead(userId, notificationId) {
      const { error } = await this.db
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", notificationId)
        .is("read_at", null);
      if (error) throw error;
    }

    async markAllRead(userId) {
      const { error } = await this.db
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    }
  }

  class ReportService {
    constructor(client) {
      this.db = client;
    }

    async queue(limit = 50) {
      const { data, error } = await this.db
        .from("community_reports")
        .select("id,reporter_id,community_id,target_type,target_id,reason,details,status,created_at")
        .in("status", ["open", "reviewing"])
        .order("created_at", { ascending: true })
        .limit(Math.min(Math.max(limit, 1), 100));
      if (error) throw error;
      return data || [];
    }

    async resolve(reportId, reviewerId, status) {
      if (!["resolved", "dismissed"].includes(status)) {
        throw new Error("Choose a valid report resolution.");
      }
      const { error } = await this.db
        .from("community_reports")
        .update({
          status,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reportId)
        .in("status", ["open", "reviewing"]);
      if (error) throw error;
    }
  }

  class EncryptionService {
    constructor() {
      this.status = "NOT_E2EE";
    }
    initializeIdentity() {
      throw pending("EncryptionService", "vetted end-to-end encryption");
    }
    encryptMessage() {
      throw pending("EncryptionService", "vetted end-to-end encryption");
    }
    decryptMessage() {
      throw pending("EncryptionService", "vetted end-to-end encryption");
    }
  }

  class GroupVoiceService {
    constructor() {
      this.status = "PENDING_INTEGRATION";
    }
    join() {
      throw pending("GroupVoiceService", "a group voice provider");
    }
    leave() {
      throw pending("GroupVoiceService", "a group voice provider");
    }
  }

  class MalwareScanService {
    constructor() {
      this.status = "PENDING_INTEGRATION";
    }
    scan() {
      throw pending("MalwareScanService", "a file scanning provider");
    }
  }

  window.arraiCommunityServices = {
    CommunityService,
    NotificationService,
    ReportService,
    EncryptionService,
    GroupVoiceService,
    MalwareScanService,
    capabilities: {
      oneToOneVoice: "CONNECTED_WEBRTC",
      realtimeChannelMessages: "CONNECTED_SUPABASE_REALTIME",
      groupVoice: "PENDING_INTEGRATION",
      endToEndEncryption: "NOT_E2EE",
      malwareScanning: "PENDING_INTEGRATION",
      privateMedia: "NOT_AVAILABLE",
      communityRoles: "CONNECTED_SERVER_CHECKED",
    },
  };
})();
