/* VYBE Vault Client */

const SESSION_KEY = "vybeVaultSession";

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

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function setSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function supabaseHeaders(config) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`
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

async function fetchUserByUsername(username) {
  const result = await restRequest(
    `/users?select=id,username,role,tier&username=eq.${encodeURIComponent(username)}`,
    { method: "GET" }
  );
  return result[0] || null;
}

async function createUser(username) {
  const result = await restRequest("/users", {
    method: "POST",
    preferReturn: true,
    body: JSON.stringify({
      username,
      role: ROLES.USER,
      tier: TIERS.Creator
    })
  });
  return result[0];
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
    button.addEventListener("click", async () => {
      const plan = button.getAttribute("data-plan");
      const session = getSession();
      if (!session) {
        showToast("Login required to activate a plan.");
        return;
      }
      try {
        const updated = await updateUser(session.id, { tier: plan });
        setSession(updated);
        renderAccountSummary();
        showToast(`Plan updated to ${plan}.`);
      } catch (error) {
        showToast("Unable to update plan.");
      }
    });
  });
}

function initAccountPage() {
  const form = document.querySelector("#login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.querySelector("input[name='username']").value.trim();
    if (!username) {
      showToast("Enter a username to continue.");
      return;
    }
    try {
      let user = await fetchUserByUsername(username);
      if (!user) {
        user = await createUser(username);
      }
      setSession(user);
      form.reset();
      renderAccountSummary();
      renderAdminPanel();
      showToast(`Welcome back, ${user.username}.`);
    } catch (error) {
      showToast("Unable to sign in.");
    }
  });

  renderAccountSummary();
  renderAdminPanel();
}

function renderAccountSummary() {
  const summary = document.querySelector("#account-summary");
  const loginState = document.querySelector("#login-state");
  if (!summary || !loginState) return;
  const session = getSession();
  if (!session) {
    summary.innerHTML = "";
    loginState.classList.remove("hidden");
    return;
  }
  loginState.classList.add("hidden");
  summary.innerHTML = `
    <div class="panel">
      <h2>Account Overview</h2>
      <p><strong>Username:</strong> ${session.username}</p>
      <p><strong>Role:</strong> ${session.role}</p>
      <p><strong>Subscription:</strong> ${session.tier}</p>
      <button class="btn btn-outline" id="logout-btn">Logout</button>
    </div>
  `;

  const logoutBtn = summary.querySelector("#logout-btn");
  logoutBtn.addEventListener("click", () => {
    setSession(null);
    renderAccountSummary();
    renderAdminPanel();
    showToast("Logged out.");
  });
}

async function renderAdminPanel() {
  const panel = document.querySelector("#admin-panel");
  if (!panel) return;
  const session = getSession();
  if (!session || session.role !== ROLES.ADMIN) {
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
          if (session.id === updated.id) {
            setSession(updated);
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

  const session = getSession();
  if (!session) {
    state.innerHTML = `<div class="status-message">Login required to upload assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  if (![ROLES.UPLOAD, ROLES.ADMIN].includes(session.role)) {
    state.innerHTML = `<div class="status-message">Upload role required to publish assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  state.innerHTML = "";
  form.classList.remove("hidden");

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
        `users/${session.id}`
      );
      const previewPath = previewInput.files[0]
        ? await storageUpload(config.previewsBucket, previewInput.files[0], `users/${session.id}`)
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
          uploader_id: session.id
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
    const session = getSession();
    const tier = session ? session.tier : null;
    const config = getConfig();

    if (!assets.length && emptyState) {
      emptyState.classList.remove("hidden");
    }

    grid.innerHTML = assets
      .map((asset, index) => {
        const canAccess = hasTierAccess(tier, asset.tier);
        const needsLogin = !session;
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

function initPage() {
  initNav();
  initPricingPage();
  initAccountPage();
  initUploadPage();
  initAssetsPage();
  const isHome = document.body.dataset.page === "home";
  if (isHome) {
    initHomeLoader();
  } else {
    initFadeIn();
  }
}

document.addEventListener("DOMContentLoaded", initPage);
