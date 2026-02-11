/* VYBE Vault Demo App */
/* Security note: localStorage is demo-only. Real apps require a backend + database. */
/* Security note: role verification must be enforced server-side. */

const STORAGE_KEYS = {
  user: "vybeVaultUser",
  users: "vybeVaultUsers",
  assets: "vybeVaultAssets"
};

const ROLES = {
  USER: "USER",
  CREATOR: "CREATOR",
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

const ADMIN_SEED = {
  username: "admin",
  role: ROLES.ADMIN,
  tier: TIERS.CreatorPlusPlus
};

function createPreviewSvg(title, accent) {
  const safeTitle = title.length > 22 ? `${title.slice(0, 22)}...` : title;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#2C1A58" stop-opacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="#0C0A12" />
      <rect x="32" y="32" width="576" height="296" rx="20" fill="url(#grad)" opacity="0.7" />
      <circle cx="90" cy="90" r="36" fill="#9B6BFF" opacity="0.75" />
      <circle cx="560" cy="270" r="48" fill="#7C3AED" opacity="0.75" />
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, Arial, sans-serif" font-size="28" fill="#F7F3E7" font-weight="700">
        ${safeTitle}
      </text>
      <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, Arial, sans-serif" font-size="14" fill="#D8D1C3" opacity="0.85">
        VYBE Vault Asset Preview
      </text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_ASSETS = [
  {
    id: "asset-001",
    name: "Neon Launch Intro",
    description: "Bold opening sequence for creator trailers.",
    tier: TIERS.Creator,
    price: "Included with membership",
    preview: createPreviewSvg("Neon Launch Intro", "#9B6BFF"),
    downloads: 0
  },
  {
    id: "asset-002",
    name: "Momentum Chart Kit",
    description: "High-end chart animations for premium dashboards.",
    tier: TIERS.CreatorPlus,
    price: "Included with membership",
    preview: createPreviewSvg("Momentum Chart Kit", "#7C3AED"),
    downloads: 0
  },
  {
    id: "asset-003",
    name: "Vault UI Panels",
    description: "Glassy panels with kinetic UI transitions.",
    tier: TIERS.CreatorPlus,
    price: "Included with membership",
    preview: createPreviewSvg("Vault UI Panels", "#9B6BFF"),
    downloads: 0
  },
  {
    id: "asset-004",
    name: "Elite Motion Toolkit",
    description: "Premium motion curves and cinematic presets.",
    tier: TIERS.CreatorPlusPlus,
    price: "Included with membership",
    preview: createPreviewSvg("Elite Motion Toolkit", "#4C1D95"),
    downloads: 0
  },
  {
    id: "asset-005",
    name: "Creator Landing Kit",
    description: "High-end landing sections for SaaS creators.",
    tier: TIERS.Creator,
    price: "Included with membership",
    preview: createPreviewSvg("Creator Landing Kit", "#9B6BFF"),
    downloads: 0
  },
  {
    id: "asset-006",
    name: "Deep Glow Transitions",
    description: "Ultra smooth transitions with ambient glow.",
    tier: TIERS.CreatorPlusPlus,
    price: "Included with membership",
    preview: createPreviewSvg("Deep Glow Transitions", "#7C3AED"),
    downloads: 0
  }
];

function getStored(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedData() {
  const users = getStored(STORAGE_KEYS.users, []);
  if (!users.find((user) => user.username === ADMIN_SEED.username)) {
    users.push(ADMIN_SEED);
    setStored(STORAGE_KEYS.users, users);
  }
  const assets = getStored(STORAGE_KEYS.assets, []);
  if (!assets.length) {
    setStored(STORAGE_KEYS.assets, SEED_ASSETS);
  }
}

function getCurrentUser() {
  return getStored(STORAGE_KEYS.user, null);
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  setStored(STORAGE_KEYS.user, user);
}

function roleForTier(tier) {
  if (tier === TIERS.CreatorPlus || tier === TIERS.CreatorPlusPlus) {
    return ROLES.CREATOR;
  }
  return ROLES.USER;
}

function hasTierAccess(userTier, assetTier) {
  if (!userTier || !TIER_ACCESS[userTier]) return false;
  return TIER_ACCESS[userTier].includes(assetTier);
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
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

function initPricingPage() {
  const buttons = document.querySelectorAll("[data-plan]");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const plan = button.getAttribute("data-plan");
      const user = getCurrentUser();
      if (!user) {
        showToast("Login required to activate a plan.");
        return;
      }
      const updatedUser = { ...user, tier: plan, role: roleForTier(plan) };
      setCurrentUser(updatedUser);

      const users = getStored(STORAGE_KEYS.users, []);
      const index = users.findIndex((item) => item.username === user.username);
      if (index >= 0) {
        users[index] = updatedUser;
      } else {
        users.push(updatedUser);
      }
      setStored(STORAGE_KEYS.users, users);
      showToast(`Plan updated to ${plan}.`);
      renderAccountSummary();
    });
  });
}

function initAccountPage() {
  const form = document.querySelector("#login-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = form.querySelector("input[name='username']").value.trim();
    if (!username) {
      showToast("Enter a username to continue.");
      return;
    }
    const users = getStored(STORAGE_KEYS.users, []);
    let user = users.find((item) => item.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      user = { username, role: ROLES.USER, tier: TIERS.Creator };
      users.push(user);
      setStored(STORAGE_KEYS.users, users);
    }
    setCurrentUser(user);
    form.reset();
    renderAccountSummary();
    showToast(`Welcome back, ${user.username}.`);
  });

  const logoutBtn = document.querySelector("#logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      setCurrentUser(null);
      renderAccountSummary();
      showToast("Logged out.");
    });
  }

  renderAccountSummary();
  renderAdminPanel();
}

function renderAccountSummary() {
  const summary = document.querySelector("#account-summary");
  const loginState = document.querySelector("#login-state");
  if (!summary || !loginState) return;
  const user = getCurrentUser();
  if (!user) {
    summary.innerHTML = "";
    loginState.classList.remove("hidden");
    renderAdminPanel();
    return;
  }
  loginState.classList.add("hidden");
  summary.innerHTML = `
    <div class="panel">
      <h2>Account Overview</h2>
      <p><strong>Username:</strong> ${user.username}</p>
      <p><strong>Role:</strong> ${user.role}</p>
      <p><strong>Subscription:</strong> ${user.tier}</p>
      <button class="btn btn-outline" id="logout-btn">Logout</button>
    </div>
  `;

  const logoutBtn = summary.querySelector("#logout-btn");
  logoutBtn.addEventListener("click", () => {
    setCurrentUser(null);
    renderAccountSummary();
    showToast("Logged out.");
  });
  renderAdminPanel();
}

function renderAdminPanel() {
  const panel = document.querySelector("#admin-panel");
  if (!panel) return;
  const user = getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN) {
    panel.innerHTML = "";
    return;
  }

  const users = getStored(STORAGE_KEYS.users, []);
  const rows = users
    .map(
      (item) => `
        <div class="panel" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;">
            <div>
              <strong>${item.username}</strong>
              <div style="opacity:0.7;font-size:13px;">Role: ${item.role} | Tier: ${item.tier}</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <select data-user="${item.username}" data-field="role">
                ${Object.values(ROLES)
                  .map((role) => `<option value="${role}" ${role === item.role ? "selected" : ""}>${role}</option>`)
                  .join("")}
              </select>
              <select data-user="${item.username}" data-field="tier">
                ${Object.values(TIERS)
                  .map((tier) => `<option value="${tier}" ${tier === item.tier ? "selected" : ""}>${tier}</option>`)
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
    select.addEventListener("change", (event) => {
      const field = event.target.getAttribute("data-field");
      const username = event.target.getAttribute("data-user");
      const usersList = getStored(STORAGE_KEYS.users, []);
      const index = usersList.findIndex((item) => item.username === username);
      if (index < 0) return;
      usersList[index][field] = event.target.value;
      setStored(STORAGE_KEYS.users, usersList);
      if (getCurrentUser() && getCurrentUser().username === username) {
        setCurrentUser(usersList[index]);
      }
      showToast("User updated.");
      renderAccountSummary();
    });
  });
}

function initUploadPage() {
  const state = document.querySelector("#upload-state");
  const form = document.querySelector("#upload-form");
  if (!state || !form) return;

  const user = getCurrentUser();
  if (!user) {
    state.innerHTML = `<div class="status-message">Login required to upload assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  if (![ROLES.CREATOR, ROLES.ADMIN].includes(user.role)) {
    state.innerHTML = `<div class="status-message">Upgrade to Creator+ or Creator++ to upload assets.</div>`;
    form.classList.add("hidden");
    return;
  }

  state.innerHTML = "";
  form.classList.remove("hidden");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.querySelector("input[name='assetName']").value.trim();
    const description = form.querySelector("textarea[name='description']").value.trim();
    const tier = form.querySelector("select[name='tier']").value;
    const previewInput = form.querySelector("input[name='preview']");
    const assetFile = form.querySelector("input[name='file']");

    if (!name || !description || !tier) {
      showToast("Complete all required fields.");
      return;
    }

    const handleSave = (preview) => {
      const assets = getStored(STORAGE_KEYS.assets, []);
      const newAsset = {
        id: `asset-${Date.now()}`,
        name,
        description,
        tier,
        price: "Included with membership",
        fileName: assetFile.files[0] ? assetFile.files[0].name : "demo-file",
        preview: preview || createPreviewSvg(name, "#9B6BFF"),
        downloads: 0,
        creator: user.username
      };
      assets.unshift(newAsset);
      setStored(STORAGE_KEYS.assets, assets);
      form.reset();
      showToast("Asset uploaded to VYBE Vault.");
    };

    if (previewInput.files && previewInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => handleSave(loadEvent.target.result);
      reader.readAsDataURL(previewInput.files[0]);
    } else {
      handleSave(null);
    }
  });
}

function initAssetsPage() {
  const grid = document.querySelector("#assets-grid");
  if (!grid) return;
  const assets = getStored(STORAGE_KEYS.assets, []);
  const user = getCurrentUser();
  const tier = user ? user.tier : null;

  grid.innerHTML = assets
    .map((asset, index) => {
      const canAccess = hasTierAccess(tier, asset.tier);
      const tierClass =
        asset.tier === TIERS.CreatorPlusPlus
          ? "tier-creator-plus-plus"
          : asset.tier === TIERS.CreatorPlus
          ? "tier-creator-plus"
          : "tier-creator";
      const buttonLabel = canAccess ? "Download" : "Upgrade Required";
      const delay = `${index * 70}ms`;
      const includedLabel = "Included with membership";
      return `
        <div class="asset-card fade-in" style="--delay:${delay}">
          <div class="asset-preview">
            <img src="${asset.preview}" alt="${asset.name}" />
          </div>
          <div>
            <div class="asset-title">${asset.name}</div>
            <div style="opacity:0.7;font-size:14px;">${asset.description}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <span class="tier-badge ${tierClass}">${asset.tier}</span>
            <span style="opacity:0.7;font-size:14px;">${includedLabel}</span>
          </div>
          <button class="btn btn-primary" ${canAccess ? "" : "disabled"} data-download="${asset.id}">
            ${buttonLabel}
          </button>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.hasAttribute("disabled")) return;
      showToast("Download started.");
    });
  });
}

function initPage() {
  seedData();
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

function buyMeACoffeeWebhookHandler() {
  /* Replace with real webhook endpoint for subscription role updates. */
}
