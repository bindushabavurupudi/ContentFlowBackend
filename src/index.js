import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { isSupabaseConfigured, supabaseAdmin, supabaseConfigError } from "./config/supabase.js";

const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT || 8081);
// const ORIGIN = process.env.APP_ORIGIN || "http://localhost:8080";
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "post-media";
if (!isSupabaseConfigured) {
  throw new Error(supabaseConfigError || "Supabase is not configured");
}

// app.use(
//   cors({
//     origin: ORIGIN,
//     credentials: false,
//   }),
// );

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://glistening-syrniki-b8b2a4.netlify.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});
const AUTH_CACHE_TTL_MS = 60_000;
const authTokenCache = new Map();

const calcAnalyticsFromPosts = (posts) => {
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const totalPosts = posts.length;

  if (totalPosts === 0) {
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      ctr: 0,
      totalScheduled: 0,
      totalPosts: 0,
    };
  }

  return {
    // Real platform insights are not wired yet; keep social metrics zero to avoid fake data.
    likes: 0,
    comments: 0,
    shares: 0,
    ctr: 0,
    totalScheduled: scheduled.length,
    totalPosts,
  };
};

const formatRelativeTime = (iso) => {
  if (!iso) return "just now";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "just now";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toTitleCase = (text) => {
  const value = String(text || "");
  if (!value) return "General";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const toPlatformListLabel = (platforms) => {
  const safe = Array.isArray(platforms) ? platforms.filter(Boolean).map((p) => toTitleCase(String(p))) : [];
  if (safe.length === 0) return "General";
  return safe.join(", ");
};

const buildDashboardPayloadFromPosts = (posts) => {
  const safePosts = Array.isArray(posts) ? posts : [];
  const analytics = calcAnalyticsFromPosts(safePosts);
  const totalDrafts = safePosts.filter((p) => p.status === "draft").length;
  const totalScheduled = safePosts.filter((p) => p.status === "scheduled").length;

  if (safePosts.length === 0) {
    return {
      analytics,
      summary: {
        totalPosts: 0,
        totalScheduled: 0,
        totalDrafts: 0,
        engagementRate: 0,
      },
      engagementTrends: [],
      platformComparison: [],
      activities: [],
      topPosts: [],
    };
  }

  const today = new Date();
  const trendMap = new Map();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, {
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      posts: 0,
    });
  }
  safePosts.forEach((p) => {
    if (!p.created_at) return;
    const key = String(p.created_at).slice(0, 10);
    if (!trendMap.has(key)) return;
    const current = trendMap.get(key);
    trendMap.set(key, { ...current, posts: current.posts + 1 });
  });
  const engagementTrends = Array.from(trendMap.values());

  const platformMap = new Map();
  safePosts.forEach((p) => {
    const platforms = Array.isArray(p.platforms) && p.platforms.length ? p.platforms : ["general"];
    platforms.forEach((platform) => {
      const key = String(platform || "general").toLowerCase();
      const prev = platformMap.get(key) || { name: toTitleCase(key), posts: 0 };
      platformMap.set(key, { ...prev, posts: prev.posts + 1 });
    });
  });
  const platformComparison = Array.from(platformMap.values()).sort((a, b) => b.posts - a.posts);

  const sortedByCreated = [...safePosts].sort((a, b) => {
    const aTs = new Date(a.created_at || 0).getTime();
    const bTs = new Date(b.created_at || 0).getTime();
    return bTs - aTs;
  });

  const activities = sortedByCreated.slice(0, 8).map((p) => {
    const platform = toPlatformListLabel(p.platforms);
    const status = p.status === "draft" ? "draft" : "scheduled";
    const content = String(p.content || "").trim();
    const shortContent = content ? `"${content.slice(0, 40)}${content.length > 40 ? "..." : ""}"` : "post";
    return {
      text: status === "draft" ? `${platform} draft saved ${shortContent}` : `${platform} post scheduled ${shortContent}`,
      time: formatRelativeTime(p.created_at),
      type: status === "draft" ? "info" : "success",
    };
  });

  const topPosts = sortedByCreated
    .filter((p) => p.status === "scheduled")
    .slice(0, 5)
    .map((p, index) => ({
      rank: index + 1,
      title: String(p.content || "Scheduled post").slice(0, 60),
      platforms: Array.isArray(p.platforms) ? p.platforms : [],
      platform: toPlatformListLabel(p.platforms),
      createdAt: p.created_at || null,
    }));

  const scheduledRatio = analytics.totalPosts > 0 ? (totalScheduled / analytics.totalPosts) * 100 : 0;

  return {
    analytics,
    summary: {
      totalPosts: analytics.totalPosts,
      totalScheduled,
      totalDrafts,
      engagementRate: Number(scheduledRatio.toFixed(1)),
    },
    engagementTrends,
    platformComparison,
    activities,
    topPosts,
  };
};

const requireSupabaseConfigured = (res) => {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    res.status(500).json({ error: supabaseConfigError || "Supabase backend is not configured" });
    return false;
  }
  return true;
};

const ensureStorageBucket = async () => {
  if (!isSupabaseConfigured || !supabaseAdmin) return;
  const { data, error } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
  if (!error && data) return;
  await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: true });
};

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

const getJwtExpMs = (token) => {
  try {
    const [, payloadB64] = String(token || "").split(".");
    if (!payloadB64) return null;
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

const requireAuth = async (req, res, next) => {
  if (!requireSupabaseConfigured(res)) return;
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }
  const now = Date.now();
  const cached = authTokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    req.authUser = cached.user;
    return next();
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired authorization token" });
  }

  req.authUser = data.user;
  const tokenExp = getJwtExpMs(token);
  const expiresAt = tokenExp ? Math.min(tokenExp, now + AUTH_CACHE_TTL_MS) : now + AUTH_CACHE_TTL_MS;
  authTokenCache.set(token, { user: data.user, expiresAt });
  next();
};

const parsePlatforms = (raw) => {
  if (Array.isArray(raw)) return raw.map((p) => String(p).toLowerCase());
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((p) => String(p).toLowerCase());
    return [];
  } catch {
    return [];
  }
};

const inferContentType = (file) => {
  const fromMime = String(file?.mimetype || "").trim().toLowerCase();
  if (fromMime) return fromMime;

  const lower = String(file?.originalname || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
};

const uploadMediaFiles = async (userId, files) => {
  if (!files || files.length === 0) return [];

  const urls = [];
  for (const file of files) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: inferContentType(file),
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload media (${file.originalname}): ${uploadError.message}`);
    }

    const { data: publicData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    urls.push(publicData.publicUrl);
  }

  return urls;
};

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    runtime: "express",
    supabaseConfigured: isSupabaseConfigured,
    storageBucket: STORAGE_BUCKET,
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    if (!requireSupabaseConfigured(res)) return;

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = String(req.body?.name || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error || !data.user) {
      const message = error?.message || "Unable to create account";
      if (/already|exists|registered/i.test(message)) {
        return res.status(409).json({ error: "User already exists" });
      }
      return res.status(400).json({ error: message });
    }

    const profilePayload = {
      id: data.user.id,
      full_name: fullName || email.split("@")[0] || "User",
      role: "team",
      auto_logout_enabled: false,
      two_factor_enabled: false,
      notifications: {
        email: true,
        push: true,
        digest: false,
        alerts: true,
      },
    };
    await supabaseAdmin.from("profiles").upsert(profilePayload, { onConflict: "id" });

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create account" });
  }
});

app.post("/api/posts", requireAuth, upload.array("media"), async (req, res) => {
  try {
    const content = String(req.body?.content || "").trim();
    const platforms = parsePlatforms(req.body?.platforms);
    const date = String(req.body?.date || "");
    const time = String(req.body?.time || "");
    const status = req.body?.status === "draft" ? "draft" : "scheduled";

    if (!content) return res.status(400).json({ error: "Content is required" });
    if (platforms.length === 0) return res.status(400).json({ error: "At least one platform is required" });
    if (!date || !time) return res.status(400).json({ error: "Date and time are required" });

    const mediaUrls = await uploadMediaFiles(req.authUser.id, req.files);
    const scheduledAt = new Date(`${date}T${time}:00`);
    const payload = {
      content,
      platforms,
      date,
      time,
      status,
      scheduled_at: Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt.toISOString(),
      media_files: mediaUrls,
      user_id: req.authUser.id,
    };

    const { data: post, error: insertError } = await supabaseAdmin
      .from("posts")
      .insert(payload)
      .select("*")
      .single();
    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(201).json({ post });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create post" });
  }
});

app.get("/api/posts", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("id, content, platforms, date, time, status, created_at")
      .eq("user_id", req.authUser.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json({ posts: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load posts" });
  }
});

app.get("/api/analytics", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("status, platforms")
      .eq("user_id", req.authUser.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json({ analytics: calcAnalyticsFromPosts(data || []) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load analytics" });
  }
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("content, status, platforms, created_at")
      .eq("user_id", req.authUser.id);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json(buildDashboardPayloadFromPosts(data || []));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load dashboard data" });
  }
});

app.get("/api/calendar/events", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("user_id", _req.authUser.id)
    .order("day", { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ events: data || [] });
});

app.patch("/api/calendar/events/:id", requireAuth, async (req, res) => {
  const payload = {};
  if (req.body?.title !== undefined) payload.title = String(req.body.title);
  if (req.body?.time !== undefined) payload.time = String(req.body.time);

  const { data, error } = await supabaseAdmin
    .from("calendar_events")
    .update(payload)
    .eq("id", req.params.id)
    .eq("user_id", req.authUser.id)
    .select("*")
    .single();

  if (error) return res.status(404).json({ error: error.message });
  return res.json({ event: data });
});

app.get("/api/team/tasks", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("team_tasks")
    .select("*")
    .eq("user_id", _req.authUser.id)
    .order("id", { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ tasks: data || [] });
});

app.patch("/api/team/tasks/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("team_tasks")
    .update({ status: String(req.body?.status || "") })
    .eq("id", req.params.id)
    .eq("user_id", req.authUser.id)
    .select("*")
    .single();
  if (error) return res.status(404).json({ error: error.message });
  return res.json({ task: data });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`API server (Express) running on http://localhost:${PORT}`);
});

ensureStorageBucket().catch((err) => {
  console.error("Storage bucket setup warning:", err instanceof Error ? err.message : err);
});
