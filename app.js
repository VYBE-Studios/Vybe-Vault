/* VYBE Vault Client */

const ROLES = {
  USER: "USER",
  UPLOAD: "UPLOAD",
  ADMIN: "ADMIN"
};

const TIERS = {
  Creator: "Creator",
  CreatorPlus: "Creator+",
  CreatorPlusPlus: "Creator++"
};

const TIER_ACCESS = {
  [TIERS.Creator]: [TIERS.Creator],
  [TIERS.CreatorPlus]: [TIERS.Creator, TIERS.CreatorPlus],
  [TIERS.CreatorPlusPlus]: [TIERS.Creator, TIERS.CreatorPlus, TIERS.CreatorPlusPlus]
};

const FALLBACK_PREVIEW = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0B0B12"/>
        <stop offset="100%" stop-color="#1C1230"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="26" fill="url(#g)"/>
    <rect x="36" y="36" width="568" height="288" rx="20" fill="none" stroke="#9B6BFF" stroke-opacity="0.3"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#E9D5FF" opacity="0.8">
      VYBE Vault
    </text>
  </svg>
`)}`;

function getConfig() {
  const url = window.VYBE_SUPABASE_URL || window.location.origin;
  const anonKey = window.VYBE_SUPABASE_ANON_KEY || "";
  const assetsBucket = window.VYBE_SUPABASE_BUCKET || "assets";
  const previewsBucket = window.VYBE_SUPABASE_PREVIEW_BUCKET || "previews";
  return {
    url: url.replace(/\/$/, ""),
    anonKey,
    restBase: `${url.replace(/\/$/, "")}/rest/v1`,
    storageBase: `${url.replace(/\/$/, "")}/storage/v1`,
    assetsBucket,
    previewsBucket
  };
}

function encodePath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
    .replace(/%2F/g, "/");
}

let supabaseClient = null;
let currentProfile = null;
let currentAuthUser = null;
let currentAuthToken = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const config = getConfig();
  if (!window.supabase) {
    throw new Error("Supabase client not loaded.");
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  return supabaseClient;
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function supabaseHeaders(config) {
  const token = currentAuthToken || config.anonKey;
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`
  };
}

async function restRequest(path, options = {}) {
  const config = getConfig();
  if (!config.anonKey) {
    throw new Error("Missing Supabase anon key.");
  }

  const headers = options.headers ? { ...options.headers } : {};
  Object.assign(headers, supabaseHeaders(config));

  const isBody = options.body !== undefined && options.body !== null;
  const isFormData = options.body instanceof FormData;
  if (isBody && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (options.preferReturn) {
    headers["Prefer"] = "return=representation";
  }

  const response = await fetch(`${config.restBase}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function storageUpload(bucket, file, prefix = "") {
  const config = getConfig();
  if (!config.anonKey) {
    throw new Error("Missing Supabase anon key.");
  }

  const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${fileExt}`;
  const path = prefix ? `${prefix}/${safeName}` : safeName;

  const response = await fetch(
    `${config.storageBase}/object/${bucket}/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(config),
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Upload failed");
  }

  return path;
}

async function storageDownload(bucket, path, filename) {
  const config = getConfig();
  const response = await fetch(
    `${config.storageBase}/object/${bucket}/${encodePath(path)}`,
    {
      method: "GET",
      headers: supabaseHeaders(config)
    }
  );
  if (!response.ok) {
    throw new Error("Download failed");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "vybe-vault-asset";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function publicPreviewUrl(bucket, path) {
  const config = getConfig();
  if (!path) return FALLBACK_PREVIEW;
  return `${config.storageBase}/object/public/${bucket}/${encodePath(path)}`;
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const links = document.querySelectorAll(".nav-links a");
  const current = window.location.pathname.split("/").pop() || "index.html";
  links.forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
}

function initFadeIn() {
  document.querySelectorAll(".fade-in").forEach((el) => {
    window.setTimeout(() => el.classList.add("is-visible"), 80);
  });
}

function initHomeLoader() {
  const loader = document.querySelector("#loader");
  const unlockBtn = document.querySelector("#unlock-btn");
  const status = document.querySelector("[data-status]");
  if (!loader || !unlockBtn) return;

  const unlock = () => {
    loader.classList.add("is-hidden");
    document.body.classList.remove("is-locked");
    initFadeIn();
    window.setTimeout(() => loader.remove(), 900);
  };

  window.setTimeout(() => {
    if (status) status.textContent = "Access ready. Awaiting unlock";
  }, 3000);

  window.setTimeout(() => {
    unlockBtn.classList.add("is-visible");
  }, 3600);

  unlockBtn.addEventListener("click", unlock);
}

function hasTierAccess(userTier, assetTier) {
  if (!userTier || !TIER_ACCESS[userTier]) return false;
  return TIER_ACCESS[userTier].includes(assetTier);
}

function getDiscordDisplayName(user) {
  const meta = user?.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    meta.preferred_username ||
    user?.email ||
    `user-${user?.id?.slice(0, 6)}`
  );
}

async function fetchUserByAuthId(authId) {
  const result = await restRequest(
    `/users?select=id,username,role,tier,auth_id&auth_id=eq.${encodeURIComponent(authId)}`,
    { method: "GET" }
  );
  return result[0] || null;
}

async function ensureUserProfile(authUser) {
  const authId = authUser.id;
  const displayName = getDiscordDisplayName(authUser);
  let user = await fetchUserByAuthId(authId);
  if (!user) {
    const created = await restRequest("/users", {
      method: "POST",
      preferReturn: true,
      body: JSON.stringify({
        auth_id: authId,
        username: displayName,
        role: ROLES.USER,
        tier: TIERS.Creator
      })
    });
    user = created[0];
  } else if (displayName && user.username !== displayName) {
    try {
      user = await updateUser(user.id, { username: displayName });
    } catch (error) {
      // Ignore username updates that conflict.
    }
  }
  return user;
}

async function refreshProfile(session = null) {
  const supabase = getSupabaseClient();
  let resolvedSession = session;
  if (!resolvedSession) {
    const { data } = await supabase.auth.getSession();
    resolvedSession = data.session;
  }
  currentAuthUser = resolvedSession?.user || null;
  currentAuthToken = resolvedSession?.access_token || null;
  if (currentAuthUser) {
    currentProfile = await ensureUserProfile(currentAuthUser);
  } else {
    currentProfile = null;
  }
  return currentProfile;
}

async function updateUser(id, payload) {
  const result = await restRequest(`/users?id=eq.${id}`, {
    method: "PATCH",
    preferReturn: true,
    body: JSON.stringify(payload)
  });
  return result[0];
}

async function fetchUsers() {
  return restRequest("/users?select=id,username,role,tier&order=created_at.desc", {
    method: "GET"
  });
}

async function fetchAssets() {
  return restRequest(
    "/assets?select=id,name,description,tier,file_path,file_name,file_type,preview_path,uploader_id,created_at&order=created_at.desc",
    { method: "GET" }
  );
}

async function initPricingPage() {
  const buttons = document.querySelectorAll("[data-plan]");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const plan = button.getAttribute("data-plan");
      if (!currentProfile) {
        showToast("Login required to activate a plan.");
        return;
      }
      try {
        const updated = await updateUser(currentProfile.id, { tier: plan });
        currentProfile = updated;
        renderAccountSummary();
        showToast(`Plan updated to ${plan}.`);
      } catch (error) {
        showToast("Unable to update plan.");
      }
    });
  });
}

function initAccountPage() {
  const loginBtn = document.querySelector("#discord-login");
  if (!loginBtn) return;
  if (loginBtn.dataset.bound !== "true") {
    loginBtn.dataset.bound = "true";
    loginBtn.addEventListener("click", async () => {
      try {
        const supabase = getSupabaseClient();
        await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: {
            redirectTo: `${window.location.origin}/account.html`
          }
        });
      } catch (error) {
        showToast("Unable to start Discord login.");
      }
    });
  }

  renderAccountSummary();
  renderAdminPanel();
}

function renderAccountSummary() {
  const summary = document.querySelector("#account-summary");
  const loginState = document.querySelector("#login-state");
  if (!summary || !loginState) return;
  if (!currentProfile) {
    summary.innerHTML = "";
    loginState.classList.remove("hidden");
    return;
  }
  loginState.classList.add("hidden");
  summary.innerHTML = `
    <div class="panel">
      <h2>Account Overview</h2>
      <p><strong>Username:</strong> ${currentProfile.username}</p>
      <p><strong>Role:</strong> ${currentProfile.role}</p>
      <p><strong>Subscription:</strong> ${currentProfile.tier}</p>
      <button class="btn btn-outline" id="logout-btn">Logout</button>
    </div>
  `;

  const logoutBtn = summary.querySelector("#logout-btn");
  logoutBtn.addEventListener("click", async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      currentProfile = null;
      currentAuthUser = null;
      currentAuthToken = null;
      renderAccountSummary();
      renderAdminPanel();
      showToast("Logged out.");
    } catch (error) {
      showToast("Unable to log out.");
    }
  });
}

async function renderAdminPanel() {
  const panel = document.querySelector("#admin-panel");
  if (!panel) return;
  const profile = currentProfile;
  if (!profile || profile.role !== ROLES.ADMIN) {
    panel.innerHTML = "";
    return;
  }

  try {
    const users = await fetchUsers();
    const rows = users
      .map(
        (user) => `
        <div class="panel" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;">
            <div>
              <strong>${user.username}</strong>
              <div style="opacity:0.7;font-size:13px;">Role: ${user.role} | Tier: ${user.tier}</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <select data-user="${user.id}" data-field="role">
                ${Object.values(ROLES)
                  .map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`)
                  .join("")}
              </select>
              <select data-user="${user.id}" data-field="tier">
                ${Object.values(TIERS)
                  .map((tier) => `<option value="${tier}" ${tier === user.tier ? "selected" : ""}>${tier}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </div>
      `
      )
      .join("");

    panel.innerHTML = `
      <div class="panel">
        <h2>Admin Role Manager</h2>
        <p style="opacity:0.7;">Only ADMIN can assign roles or tiers.</p>
        <div>${rows}</div>
      </div>
    `;

    panel.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", async (event) => {
        const field = event.target.getAttribute("data-field");
        const userId = event.target.getAttribute("data-user");
        const value = event.target.value;
        try {
          const updated = await updateUser(userId, { [field]: value });
          if (profile.id === updated.id) {
            currentProfile = updated;
            renderAccountSummary();
          }
          showToast("User updated.");
        } catch (error) {
          showToast("Unable to update user.");
        }
      });
    });
  } catch (error) {
    panel.innerHTML = "";
  }
}

async function initUploadPage() {
  const state = document.querySelector("#upload-state");
  const form = document.querySelector("#upload-form");
  if (!state || !form) return;

  const profile = currentProfile;
  if (!profile) {
    state.innerHTML = `<div class="status-message">Login required to upload assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  if (![ROLES.UPLOAD, ROLES.ADMIN].includes(profile.role)) {
    state.innerHTML = `<div class="status-message">Upload role required to publish assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  state.innerHTML = "";
  form.classList.remove("hidden");

  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = form.querySelector("input[name='assetName']").value.trim();
    const description = form.querySelector("textarea[name='description']").value.trim();
    const tier = form.querySelector("select[name='tier']").value;
    const previewInput = form.querySelector("input[name='preview']");
    const assetFile = form.querySelector("input[name='file']");

    if (!name || !description || !tier || !assetFile.files[0]) {
      showToast("Complete all required fields.");
      return;
    }

    try {
      const config = getConfig();
      const filePath = await storageUpload(
        config.assetsBucket,
        assetFile.files[0],
        `users/${profile.id}`
      );
      const previewPath = previewInput.files[0]
        ? await storageUpload(config.previewsBucket, previewInput.files[0], `users/${profile.id}`)
        : null;

      await restRequest("/assets", {
        method: "POST",
        preferReturn: true,
        body: JSON.stringify({
          name,
          description,
          tier,
          file_path: filePath,
          file_name: assetFile.files[0].name,
          file_type: assetFile.files[0].type || "application/octet-stream",
          file_size: assetFile.files[0].size,
          preview_path: previewPath,
          uploader_id: profile.id
        })
      });

      form.reset();
      showToast("Asset uploaded to VYBE Vault.");
    } catch (error) {
      showToast("Upload failed. Check your role and try again.");
    }
  });
}

async function initAssetsPage() {
  const grid = document.querySelector("#assets-grid");
  const emptyState = document.querySelector("#assets-empty");
  if (!grid) return;

  try {
    const assets = await fetchAssets();
    const profile = currentProfile;
    const tier = profile ? profile.tier : null;
    const config = getConfig();

    if (!assets.length && emptyState) {
      emptyState.classList.remove("hidden");
    }

    grid.innerHTML = assets
      .map((asset, index) => {
        const canAccess = hasTierAccess(tier, asset.tier);
        const needsLogin = !profile;
        const tierClass =
          asset.tier === TIERS.CreatorPlusPlus
            ? "tier-creator-plus-plus"
            : asset.tier === TIERS.CreatorPlus
            ? "tier-creator-plus"
            : "tier-creator";
        const buttonLabel = needsLogin ? "Login Required" : canAccess ? "Download" : "Upgrade Required";
        const delay = `${index * 70}ms`;
        const preview = asset.preview_path
          ? publicPreviewUrl(config.previewsBucket, asset.preview_path)
          : FALLBACK_PREVIEW;
        return `
          <div class="asset-card fade-in" style="--delay:${delay}">
            <div class="asset-preview">
              <img src="${preview}" alt="${asset.name}" />
            </div>
            <div>
              <div class="asset-title">${asset.name}</div>
              <div style="opacity:0.7;font-size:14px;">${asset.description}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <span class="tier-badge ${tierClass}">${asset.tier}</span>
              <span style="opacity:0.7;font-size:14px;">Included with membership</span>
            </div>
            <button class="btn btn-primary" ${canAccess ? "" : "disabled"} data-download="${asset.id}">
              ${buttonLabel}
            </button>
          </div>
        `;
      })
      .join("");

    grid.querySelectorAll("[data-download]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.hasAttribute("disabled")) return;
        const id = button.getAttribute("data-download");
        const asset = assets.find((item) => String(item.id) === String(id));
        if (!asset) return;
        try {
          await storageDownload(config.assetsBucket, asset.file_path, asset.file_name);
          showToast("Download started.");
        } catch (error) {
          showToast("Upgrade required to download.");
        }
      });
    });

    initFadeIn();
  } catch (error) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
    }
  }
}

async function initPage() {
  initNav();

  try {
    getSupabaseClient();
    await refreshProfile();
  } catch (error) {
    showToast("Supabase configuration missing.");
  }

  initPricingPage();
  initAccountPage();
  await initUploadPage();
  await initAssetsPage();

  const isHome = document.body.dataset.page === "home";
  if (isHome) {
    initHomeLoader();
  } else {
    initFadeIn();
  }

  try {
    const supabase = getSupabaseClient();
    supabase.auth.onAuthStateChange(async (event, session) => {
      await refreshProfile(session);
      renderAccountSummary();
      renderAdminPanel();
      initPricingPage();
      initUploadPage();
      initAssetsPage();
    });
  } catch (error) {
    // Ignore if Supabase is not configured.
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPage();
});
