/* ==========================================================================
   STACKLY — Online Fashion & Clothing Boutique
   Application script: API, rendering, cart, wishlist, checkout, interactions
   ========================================================================== */

"use strict";

/* ------------------------------ Config ---------------------------------- */
const API_URL =
  "https://dummyjson.com/products?limit=0&select=id,title,description,price,discountPercentage,rating,stock,brand,category,thumbnail,images";

const FASHION_CATEGORIES = [
  "womens-dresses",
  "mens-shirts",
  "womens-shoes",
  "mens-shoes",
  "womens-bags",
  "womens-jewellery",
  "womens-watches",
  "mens-watches",
  "tops",
];

const CATEGORY_META = {
  "womens-dresses": { label: "Women's Dresses", short: "Dresses", tag: "Fluid silhouettes" },
  "mens-shirts": { label: "Men's Shirts", short: "Shirts", tag: "Sharp tailoring" },
  "womens-shoes": { label: "Women's Shoes", short: "Women's Shoes", tag: "Every step elevated" },
  "mens-shoes": { label: "Men's Shoes", short: "Men's Shoes", tag: "Built for the city" },
  "womens-bags": { label: "Bags & Accessories", short: "Bags", tag: "The finishing touch" },
  "womens-jewellery": { label: "Jewellery", short: "Jewellery", tag: "Quiet luxury" },
  "womens-watches": { label: "Women's Watches", short: "Women's Watches", tag: "Time, refined" },
  "mens-watches": { label: "Men's Watches", short: "Men's Watches", tag: "Classic precision" },
  tops: { label: "Tops & Tees", short: "Tops", tag: "Everyday essentials" },
};

const FEATURED_CATEGORIES = [
  "womens-dresses",
  "mens-shirts",
  "womens-bags",
  "womens-shoes",
  "womens-jewellery",
  "mens-watches",
];

const COUPONS = {
  WELCOME10: { type: "percent", value: 10, min: 0, label: "10% off" },
  STYLE20: { type: "percent", value: 20, min: 100, label: "20% off $100+" },
  FREESHIP: { type: "shipping", value: 0, min: 0, label: "Free shipping" },
};

const FREE_SHIPPING_AT = 75;
const SHIPPING_FEE = 7.9;
const PAGE_SIZE = 12;
const MAX_QTY = 99;

const STORAGE = {
  cart: "stackly_cart_v1",
  wishlist: "stackly_wishlist_v1",
  coupon: "stackly_coupon_v1",
  orders: "stackly_orders_v1",
  customer: "stackly_customer_v1",
  subscribers: "stackly_subscribers_v1",
};

/* ------------------------------- State ---------------------------------- */
const state = {
  products: [],
  filtered: [],
  newIds: new Set(),
  visible: PAGE_SIZE,
  search: "",
  category: "all",
  sort: "featured",
  loading: true,
  error: false,
  cart: [],
  wishlist: [],
  coupon: null,
  heroProductId: null,
  modalProductId: null,
  modalSize: null,
  modalQty: 1,
  lastFocus: null,
  toastTimer: null,
  searchTimer: null,
  toastAction: null,
  activeCategoryTab: null,
};

const ui = {};

/* ------------------------------ Helpers --------------------------------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = (value) => money.format(Number.isFinite(Number(value)) ? Number(value) : 0);
const round2 = (value) => Math.round(value * 100) / 100;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function catLabel(slug) {
  return CATEGORY_META[slug]?.short || titleCase(slug);
}

function catFull(slug) {
  return CATEGORY_META[slug]?.label || titleCase(slug);
}

function sizesFor(category) {
  if (category === "mens-shoes") return ["39", "40", "41", "42", "43", "44", "45"];
  if (category === "womens-shoes") return ["36", "37", "38", "39", "40", "41"];
  if (["womens-watches", "mens-watches", "womens-jewellery", "womens-bags"].includes(category)) {
    return ["One Size"];
  }
  return ["XS", "S", "M", "L", "XL"];
}

function defaultSize(sizes) {
  if (!Array.isArray(sizes) || !sizes.length) return "One Size";
  if (sizes.includes("M")) return "M";
  return sizes[Math.floor(sizes.length / 2)];
}

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    /* ignore */
  }
}

function starsMarkup(rating, className = "") {
  return `<span class="stars ${className}" style="--rating:${Number(rating) || 0}" aria-hidden="true">★★★★★</span>`;
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deliveryRange() {
  const format = (date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(end.getDate() + 5);
  return `${format(start)} – ${format(end)}`;
}

function localImage(productId, url) {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const basename = clean.split("/").pop();
  if (!basename) return "";
  const id = Number(productId);
  const assetFolder = id <= 98 ? "Assets1" : id <= 177 ? "Assets2" : "Assets3";
  return `${assetFolder}/images/products/${productId}/${basename.replace(/\.[a-z0-9]+$/i, ".webp")}`;
}

function normalizeProduct(product) {
  const images =
    Array.isArray(product.images) && product.images.length
      ? product.images.filter(Boolean)
      : [product.thumbnail].filter(Boolean);
  const localImages = images.map((url) => localImage(product.id, url)).filter(Boolean);
  const localThumb = product.thumbnail
    ? localImage(product.id, product.thumbnail)
    : localImages[0] || "";
  const discount = Number(product.discountPercentage) || 0;
  const originalPrice =
    discount > 0 && discount < 100 ? round2(product.price / (1 - discount / 100)) : null;
  return {
    ...product,
    price: Number(product.price) || 0,
    rating: Number(product.rating) || 0,
    stock: Number(product.stock) || 0,
    discountPercentage: discount,
    images: localImages.length ? localImages : [localThumb].filter(Boolean),
    thumbnail: localThumb || localImages[0] || "",
    originalPrice,
    sizes: sizesFor(product.category),
  };
}

function snapshotProduct(product) {
  return {
    id: product.id,
    title: product.title,
    price: Number(product.price) || 0,
    thumbnail: product.thumbnail || (product.images && product.images[0]) || "",
    category: product.category,
    rating: Number(product.rating) || 0,
    discountPercentage: Number(product.discountPercentage) || 0,
    stock: Number(product.stock) || 0,
    brand: product.brand || "",
    description: product.description || "",
    images:
      Array.isArray(product.images) && product.images.length
        ? product.images
        : [product.thumbnail].filter(Boolean),
    sizes: Array.isArray(product.sizes) ? product.sizes : sizesFor(product.category),
    originalPrice: product.originalPrice || null,
  };
}

function findProduct(id) {
  const numeric = Number(id);
  return (
    state.products.find((product) => product.id === numeric) ||
    state.wishlist.find((product) => product.id === numeric) ||
    null
  );
}

/* -------------------------------- DOM ----------------------------------- */
function cacheDom() {
  ui.header = $("#header");
  ui.menuBtn = $("#menuBtn");
  ui.searchBtn = $("#searchBtn");
  ui.wishBtn = $("#wishBtn");
  ui.cartBtn = $("#cartBtn");
  ui.wishCount = $("#wishCount");
  ui.cartCount = $("#cartCount");

  ui.heroMainImg = $("#heroMainImg");
  ui.heroMainFrame = $("#heroMainFrame");
  ui.heroSmallImg = $("#heroSmallImg");
  ui.heroSmallFrame = $("#heroSmallImg")?.closest(".hero-frame");
  ui.heroPick = $("#heroPick");
  ui.heroPickTitle = $("#heroPickTitle");
  ui.heroPickPrice = $("#heroPickPrice");
  ui.newsletterImg = $("#newsletterImg");
  ui.newsletterMedia = $("#newsletterImg")?.closest(".newsletter-media");

  ui.categoriesGrid = $("#categoriesGrid");
  ui.newArrivalsGrid = $("#newArrivalsGrid");
  ui.trendingGrid = $("#trendingGrid");
  ui.categoryChips = $("#categoryChips");
  ui.menuCategoryChips = $("#menuCategoryChips");
  ui.searchInput = $("#searchInput");
  ui.searchClear = $("#searchClear");
  ui.trendingSearchForm = $("#trendingSearchForm");
  ui.sortSelect = $("#sortSelect");
  ui.resultsCount = $("#resultsCount");
  ui.loadMoreWrap = $("#loadMoreWrap");
  ui.loadMoreBtn = $("#loadMoreBtn");
  ui.loadMoreText = $("#loadMoreText");
  ui.loadMoreProgress = $("#loadMoreProgress");

  ui.cartDrawer = $("#cartDrawer");
  ui.cartItems = $("#cartItems");
  ui.cartEmpty = $("#cartEmpty");
  ui.cartFooter = $("#cartFooter");
  ui.cartHeadingCount = $("#cartHeadingCount");
  ui.shipMeter = $("#shipMeter");
  ui.shipProgress = $("#shipProgress");
  ui.shipProgressText = $("#shipProgressText");
  ui.cartSubtotal = $("#cartSubtotal");
  ui.cartDiscount = $("#cartDiscount");
  ui.discountRow = $("#discountRow");
  ui.discountLabel = $("#discountLabel");
  ui.cartShipping = $("#cartShipping");
  ui.cartTotal = $("#cartTotal");
  ui.couponForm = $("#couponForm");
  ui.couponInput = $("#couponInput");
  ui.couponApplied = $("#couponApplied");
  ui.couponAppliedCode = $("#couponAppliedCode");
  ui.couponRemove = $("#couponRemove");
  ui.couponMsg = $("#couponMsg");
  ui.couponHints = $("#couponHints");
  ui.checkoutBtn = $("#checkoutBtn");

  ui.wishDrawer = $("#wishDrawer");
  ui.wishItems = $("#wishItems");
  ui.wishEmpty = $("#wishEmpty");
  ui.wishHeadingCount = $("#wishHeadingCount");
  ui.wishFooter = $("#wishFooter");

  ui.productModal = $("#productModal");
  ui.pmMainImg = $("#pmMainImg");
  ui.pmBadge = $("#pmBadge");
  ui.pmThumbs = $("#pmThumbs");
  ui.pmCategory = $("#pmCategory");
  ui.pmTitle = $("#pmTitle");
  ui.pmStars = $("#pmStars");
  ui.pmRating = $("#pmRating");
  ui.pmStock = $("#pmStock");
  ui.pmPrice = $("#pmPrice");
  ui.pmOld = $("#pmOld");
  ui.pmDiscount = $("#pmDiscount");
  ui.pmDesc = $("#pmDesc");
  ui.pmSizes = $("#pmSizes");
  ui.pmSizeWrap = $("#pmSizeWrap");
  ui.pmQty = $("#pmQty");
  ui.pmQtyMinus = $("#pmQtyMinus");
  ui.pmQtyPlus = $("#pmQtyPlus");
  ui.pmAdd = $("#pmAdd");
  ui.pmWish = $("#pmWish");

  ui.checkoutModal = $("#checkoutModal");
  ui.checkoutForm = $("#checkoutForm");
  ui.coItems = $("#coItems");
  ui.coSubtotal = $("#coSubtotal");
  ui.coDiscountRow = $("#coDiscountRow");
  ui.coDiscount = $("#coDiscount");
  ui.coShipping = $("#coShipping");
  ui.coTotal = $("#coTotal");
  ui.coEta = $("#coEta");
  ui.placeOrderBtn = $("#placeOrderBtn");

  ui.orderModal = $("#orderModal");
  ui.orderEmail = $("#orderEmail");
  ui.orderNumber = $("#orderNumber");
  ui.orderEta = $("#orderEta");
  ui.orderPayment = $("#orderPayment");
  ui.orderItems = $("#orderItems");
  ui.orderTotal = $("#orderTotal");
  ui.orderContinue = $("#orderContinue");

  ui.sizeModal = $("#sizeModal");
  ui.sizeGuideBtn = $("#sizeGuideBtn");

  ui.searchPanel = $("#searchPanel");
  ui.searchForm = $("#searchForm");
  ui.overlaySearchInput = $("#overlaySearchInput");
  ui.searchClose = $("#searchClose");

  ui.mobileMenu = $("#mobileMenu");
  ui.mobileMenuClose = $("#mobileMenuClose");

  ui.newsletterForm = $("#newsletterForm");
  ui.newsletterEmail = $("#newsletterEmail");
  ui.newsletterMsg = $("#newsletterMsg");

  ui.toast = $("#toast");
  ui.toastText = $("#toastText");
  ui.toastAction = $("#toastAction");
}

/* ----------------------------- API calls -------------------------------- */
async function loadProducts() {
  state.loading = true;
  state.error = false;
  renderSkeletons();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

    const payload = await response.json();
    const raw = Array.isArray(payload.products) ? payload.products : [];
    const fashion = raw
      .filter((product) => FASHION_CATEGORIES.includes(product.category))
      .map(normalizeProduct);

    if (!fashion.length) throw new Error("No fashion products returned");

    state.products = fashion;
    state.loading = false;
    state.error = false;

    const latest = [...fashion].sort((a, b) => b.id - a.id).slice(0, 4);
    state.newIds = new Set(latest.map((product) => product.id));

    renderHero(fashion);
    renderNewsletter(fashion);
    renderCategories();
    renderCategoryChips();
    renderNewArrivals();
    applyFilters(true);
    refreshAOS();
  } catch (error) {
    clearTimeout(timeout);
    console.error("Stackly: product fetch failed", error);
    state.loading = false;
    state.error = true;
    renderErrorState();
  }
}

/* ------------------------------- Hero ----------------------------------- */
function wireImage(img, frame, src, alt) {
  if (!img) return;
  img.classList.remove("is-loaded");
  frame?.classList.remove("is-loaded");

  const done = () => {
    img.classList.add("is-loaded");
    frame?.classList.add("is-loaded");
  };

  img.onload = done;
  img.onerror = () => {
    done();
    img.style.opacity = "0";
  };
  img.alt = alt;
  img.src = src;
  if (img.complete && img.naturalWidth) done();
}

function renderHero(products) {
  const dresses = products.filter((product) => product.category === "womens-dresses");
  const accessories = products.filter((product) =>
    ["womens-bags", "womens-jewellery", "womens-shoes"].includes(product.category)
  );

  const main =
    [...dresses].sort((a, b) => b.rating - a.rating)[0] ||
    [...products].sort((a, b) => b.rating - a.rating)[0];

  const accent =
    [...accessories].sort((a, b) => b.rating - a.rating)[0] ||
    products.find((product) => product.id !== main?.id);

  if (main) {
    const src = main.images[0] || main.thumbnail;
    wireImage(ui.heroMainImg, ui.heroMainFrame, src, `${main.title} — editor's pick from Stackly`);
    state.heroProductId = main.id;

    if (ui.heroPick) {
      ui.heroPick.hidden = false;
      ui.heroPick.dataset.openProduct = String(main.id);
      ui.heroPickTitle.textContent = main.title;
      ui.heroPickPrice.textContent = `${fmt(main.price)} · ${main.rating.toFixed(1)} ★`;
    }
  }

  if (accent) {
    const src = accent.images[1] || accent.images[0] || accent.thumbnail;
    wireImage(ui.heroSmallImg, ui.heroSmallFrame, src, `${accent.title} from Stackly`);
  }
}

function renderNewsletter(products) {
  const dresses = products.filter((product) => product.category === "womens-dresses");
  const pick = [...dresses].sort((a, b) => b.rating - a.rating)[0] || products[0];
  if (!pick) return;
  const src = pick.images[1] || pick.images[0] || pick.thumbnail;
  wireImage(ui.newsletterImg, ui.newsletterMedia, src, `A look from the ${pick.title} collection`);
}

/* ----------------------------- Categories ------------------------------- */
function renderCategories() {
  if (!ui.categoriesGrid) return;
  ui.categoriesGrid.setAttribute("aria-busy", "false");

  const markup = FEATURED_CATEGORIES.map((slug, index) => {
    const meta = CATEGORY_META[slug] || { label: titleCase(slug), tag: "Curated" };
    const items = state.products.filter((product) => product.category === slug);
    if (!items.length) return "";
    const cover = [...items].sort((a, b) => b.rating - a.rating)[0];
    const image = cover.thumbnail || cover.images[0];
    return `
      <button class="category-card" type="button" data-category="${esc(slug)}"
        aria-label="Shop ${esc(meta.label)}" data-aos="fade-up" data-aos-delay="${index * 60}">
        <img src="${esc(image)}" alt="${esc(meta.label)}" loading="lazy" decoding="async">
        <div class="category-content">
          <div>
            <h3>${esc(meta.label)}</h3>
            <p>${items.length} pieces · ${esc(meta.tag)}</p>
          </div>
          <span class="category-arrow" aria-hidden="true">
            <svg class="icon"><use href="#i-arrow-up-right"/></svg>
          </span>
        </div>
      </button>`;
  }).join("");

  ui.categoriesGrid.innerHTML = markup || emptyStateMarkup("No categories yet", "The collection is loading.");
}

function renderCategoryChips() {
  const counts = new Map();
  state.products.forEach((product) => {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
  });

  const order = [
    ...FEATURED_CATEGORIES,
    ...FASHION_CATEGORIES.filter((slug) => !FEATURED_CATEGORIES.includes(slug)),
  ].filter((slug) => counts.has(slug));

  const allChip = (extraClass = "") => `
    <button class="chip ${state.category === "all" ? "is-active" : ""} ${extraClass}"
      type="button" data-category="all">All pieces <span>${state.products.length}</span></button>`;

  const chips = order
    .map((slug) => `
      <button class="chip ${state.category === slug ? "is-active" : ""}" type="button" data-category="${esc(slug)}">
        ${esc(catLabel(slug))} <span>${counts.get(slug)}</span>
      </button>`)
    .join("");

  if (ui.categoryChips) ui.categoryChips.innerHTML = allChip() + chips;
  if (ui.menuCategoryChips) ui.menuCategoryChips.innerHTML = allChip() + chips;
}

function syncChips() {
  $$("#categoryChips .chip, #menuCategoryChips .chip").forEach((chip) => {
    const active = chip.dataset.category === state.category;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
}

/* --------------------------- Product cards ------------------------------ */
function isWished(id) {
  return state.wishlist.some((item) => item.id === Number(id));
}

function productCardMarkup(product, index = 0, isNew = false) {
  const discount = Math.round(product.discountPercentage || 0);
  const wished = isWished(product.id);
  const image = product.thumbnail || (product.images && product.images[0]) || "";
  return `
    <article class="product-card" data-product-card="${product.id}" data-aos="fade-up"
      data-aos-delay="${(index % 4) * 60}">
      <div class="pc-media">
        <button class="pc-open" type="button" data-open-product="${product.id}"
          aria-label="View details for ${esc(product.title)}">
          <img src="${esc(image)}" alt="${esc(product.title)}" loading="lazy" decoding="async">
        </button>
        <div class="pc-badges">
          ${isNew ? '<span class="badge">New in</span>' : ""}
          ${discount >= 1 ? `<span class="badge badge-sale">-${discount}%</span>` : ""}
        </div>
        <button class="pc-wish ${wished ? "is-active" : ""}" type="button"
          data-wish-toggle="${product.id}" aria-pressed="${wished}"
          aria-label="${wished ? "Remove from wishlist" : "Save to wishlist"}">
          <svg class="icon"><use href="#i-heart"/></svg>
        </button>
        <button class="pc-quick" type="button" data-quick-add="${product.id}">
          <svg class="icon"><use href="#i-bag"/></svg> Quick add
        </button>
      </div>
      <div class="pc-body">
        <p class="pc-cat">${esc(catFull(product.category))}</p>
        <h3 class="pc-title">
          <button type="button" data-open-product="${product.id}">${esc(product.title)}</button>
        </h3>
        <div class="pc-rating">
          ${starsMarkup(product.rating)}
          <span>${product.rating.toFixed(1)}</span>
        </div>
        <div class="pc-price-row">
          <span class="pc-price">${fmt(product.price)}</span>
          ${product.originalPrice ? `<s class="pc-old">${fmt(product.originalPrice)}</s>` : ""}
        </div>
      </div>
    </article>`;
}

function renderNewArrivals() {
  if (!ui.newArrivalsGrid) return;
  ui.newArrivalsGrid.setAttribute("aria-busy", "false");
  const latest = [...state.products].sort((a, b) => b.id - a.id).slice(0, 4);
  ui.newArrivalsGrid.innerHTML = latest.map((product, index) => productCardMarkup(product, index, true)).join("");
}

/* ---------------------------- Trending ---------------------------------- */
function applyFilters(resetVisible = false) {
  if (state.loading || state.error) return;
  if (resetVisible) state.visible = PAGE_SIZE;

  let list = [...state.products];

  if (state.category !== "all") {
    list = list.filter((product) => product.category === state.category);
  }

  const query = state.search.trim().toLowerCase();
  if (query) {
    list = list.filter((product) => {
      const haystack = [
        product.title,
        product.brand,
        catFull(product.category),
        catLabel(product.category),
        product.description,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  switch (state.sort) {
    case "price-asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
      list.sort((a, b) => b.id - a.id);
      break;
    case "name":
      list.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      list.sort((a, b) => b.rating - a.rating || b.stock - a.stock);
  }

  state.filtered = list;
  renderTrending();
  updateResults();
  syncChips();
  syncSearchClear();
  refreshAOS();
}

function renderTrending() {
  if (!ui.trendingGrid) return;
  ui.trendingGrid.setAttribute("aria-busy", "false");

  if (!state.filtered.length) {
    ui.trendingGrid.innerHTML = `
      <div class="state-card">
        <span class="state-icon"><svg class="icon"><use href="#i-search"/></svg></span>
        <h3>Nothing matched that edit</h3>
        <p>Try a different search term, or reset the filters to browse the full collection.</p>
        <button class="btn btn-outline" type="button" data-reset-filters>Reset filters</button>
      </div>`;
    return;
  }

  const visibleItems = state.filtered.slice(0, state.visible);
  ui.trendingGrid.innerHTML = visibleItems
    .map((product, index) => productCardMarkup(product, index, state.newIds.has(product.id)))
    .join("");
}

function updateResults() {
  if (!ui.resultsCount) return;
  const total = state.filtered.length;
  const shown = Math.min(state.visible, total);

  if (state.loading) {
    ui.resultsCount.textContent = "Loading pieces…";
    return;
  }
  if (!total) {
    ui.resultsCount.textContent = "No pieces found";
    if (ui.loadMoreWrap) ui.loadMoreWrap.hidden = true;
    return;
  }

  ui.resultsCount.innerHTML = `Showing <strong>${shown}</strong> of <strong>${total}</strong> pieces`;

  if (ui.loadMoreWrap && ui.loadMoreProgress && ui.loadMoreBtn) {
    const more = total > shown;
    ui.loadMoreWrap.hidden = !more;
    ui.loadMoreBtn.disabled = !more;
    ui.loadMoreProgress.textContent = more ? `You've viewed ${shown} of ${total}` : "You've seen it all";
    if (more) {
      const remaining = total - shown;
      ui.loadMoreText.textContent = `Load ${Math.min(PAGE_SIZE, remaining)} more pieces`;
    }
  }
}

function syncSearchClear() {
  if (!ui.searchClear) return;
  ui.searchClear.hidden = !state.search.trim() && !ui.searchInput?.value;
}

function resetFilters() {
  state.search = "";
  state.category = "all";
  state.sort = "featured";
  state.visible = PAGE_SIZE;
  if (ui.searchInput) ui.searchInput.value = "";
  if (ui.sortSelect) ui.sortSelect.value = "featured";
  applyFilters(true);
}

function applyCategory(category, options = {}) {
  state.category = category || "all";
  state.visible = PAGE_SIZE;
  applyFilters(true);
  if (options.closeMenu) closeLayer(ui.mobileMenu);
  if (options.scroll) scrollToSection("trending");
}

/* --------------------------- Loading & errors --------------------------- */
function skeletonMarkup(count) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="sk-media"></div>
        <div class="sk-line w-40"></div>
        <div class="sk-line w-80"></div>
        <div class="sk-line w-30"></div>
      </div>`
    )
    .join("");
}

function emptyStateMarkup(title, copy) {
  return `
    <div class="state-card">
      <span class="state-icon"><svg class="icon"><use href="#i-bag"/></svg></span>
      <h3>${esc(title)}</h3>
      <p>${esc(copy)}</p>
      <button class="btn btn-outline" type="button" data-retry>Try again</button>
    </div>`;
}

function renderSkeletons() {
  if (ui.resultsCount) ui.resultsCount.textContent = "Loading pieces…";
  if (ui.loadMoreWrap) ui.loadMoreWrap.hidden = true;

  if (ui.categoriesGrid) {
    ui.categoriesGrid.setAttribute("aria-busy", "true");
    ui.categoriesGrid.innerHTML = Array.from({ length: 6 })
      .map(() => '<div class="category-skeleton" aria-hidden="true"></div>')
      .join("");
  }
  if (ui.newArrivalsGrid) {
    ui.newArrivalsGrid.setAttribute("aria-busy", "true");
    ui.newArrivalsGrid.innerHTML = skeletonMarkup(4);
  }
  if (ui.trendingGrid) {
    ui.trendingGrid.setAttribute("aria-busy", "true");
    ui.trendingGrid.innerHTML = skeletonMarkup(8);
  }
}

function renderErrorState() {
  const markup = `
    <div class="state-card is-error">
      <span class="state-icon"><svg class="icon"><use href="#i-close"/></svg></span>
      <h3>We couldn't load the collection</h3>
      <p>The boutique is having a moment. Check your connection and try again — your bag and wishlist are safe.</p>
      <button class="btn btn-primary" type="button" data-retry>
        Retry
        <svg class="icon"><use href="#i-return"/></svg>
      </button>
    </div>`;

  if (ui.categoriesGrid) {
    ui.categoriesGrid.setAttribute("aria-busy", "false");
    ui.categoriesGrid.innerHTML = markup;
  }
  if (ui.newArrivalsGrid) {
    ui.newArrivalsGrid.setAttribute("aria-busy", "false");
    ui.newArrivalsGrid.innerHTML = markup;
  }
  if (ui.trendingGrid) {
    ui.trendingGrid.setAttribute("aria-busy", "false");
    ui.trendingGrid.innerHTML = "";
  }
  if (ui.resultsCount) ui.resultsCount.textContent = "Unable to load products";
  if (ui.loadMoreWrap) ui.loadMoreWrap.hidden = true;
  state.filtered = [];
}

async function loadMore() {
  if (!ui.loadMoreBtn || ui.loadMoreBtn.classList.contains("is-loading")) return;
  ui.loadMoreBtn.classList.add("is-loading");
  ui.loadMoreBtn.disabled = true;
  if (ui.loadMoreText) ui.loadMoreText.textContent = "Loading";

  await new Promise((resolve) => setTimeout(resolve, 420));

  state.visible = Math.min(state.visible + PAGE_SIZE, state.filtered.length);
  renderTrending();
  updateResults();
  refreshAOS();

  ui.loadMoreBtn.classList.remove("is-loading");
  ui.loadMoreBtn.disabled = false;
}

/* ==========================================================================
   Cart, wishlist, coupons, checkout
   ========================================================================== */

function hydrateStorage() {
  const storedCart = storageGet(STORAGE.cart, []);
  state.cart = Array.isArray(storedCart)
    ? storedCart
        .filter((item) => item && item.id)
        .map((item) => {
          const size = item.size || "One Size";
          return {
            ...item,
            key: item.key || `${item.id}::${size}`,
            size,
            qty: Math.min(MAX_QTY, Math.max(1, Number(item.qty) || 1)),
            price: Number(item.price) || 0,
            thumbnail:
              item.thumbnail && /^https?:/i.test(item.thumbnail)
                ? localImage(item.id, item.thumbnail)
                : item.thumbnail || "",
          };
        })
    : [];

  const storedWishlist = storageGet(STORAGE.wishlist, []);
  state.wishlist = Array.isArray(storedWishlist)
    ? storedWishlist
        .filter((item) => item && item.id)
        .map((item) => ({
          ...item,
          thumbnail:
            item.thumbnail && /^https?:/i.test(item.thumbnail)
              ? localImage(item.id, item.thumbnail)
              : item.thumbnail || "",
          images:
            (Array.isArray(item.images) && item.images.length
              ? item.images
              : [item.thumbnail].filter(Boolean)
            ).map((image) =>
              /^https?:/i.test(image) ? localImage(item.id, image) : image
            ),
          sizes:
            Array.isArray(item.sizes) && item.sizes.length
              ? item.sizes
              : sizesFor(item.category),
        }))
    : [];

  const storedCoupon = storageGet(STORAGE.coupon, null);
  state.coupon =
    storedCoupon && COUPONS[storedCoupon.code]
      ? { code: storedCoupon.code, ...COUPONS[storedCoupon.code] }
      : null;
}

function saveCart() {
  storageSet(STORAGE.cart, state.cart);
}

function saveWishlist() {
  storageSet(STORAGE.wishlist, state.wishlist);
}

function cartKey(id, size) {
  return `${id}::${size}`;
}

function cartSubtotal() {
  return round2(state.cart.reduce((sum, item) => sum + item.price * item.qty, 0));
}

function computeTotals() {
  const subtotal = cartSubtotal();
  let discount = 0;

  if (state.coupon && state.coupon.type === "percent") {
    discount = round2((subtotal * state.coupon.value) / 100);
  }

  const afterDiscount = Math.max(0, round2(subtotal - discount));
  let shipping = 0;

  if (state.cart.length) {
    if (state.coupon && state.coupon.type === "shipping") {
      shipping = 0;
    } else {
      shipping = afterDiscount >= FREE_SHIPPING_AT ? 0 : SHIPPING_FEE;
    }
  }

  return {
    subtotal,
    discount,
    shipping,
    total: round2(afterDiscount + shipping),
  };
}

function updateCartBadges() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  if (ui.cartCount) {
    ui.cartCount.textContent = String(count);
    ui.cartCount.hidden = count === 0;
  }
  if (ui.cartHeadingCount) {
    ui.cartHeadingCount.textContent = `${count} item${count === 1 ? "" : "s"}`;
  }
}

function addToCart(product, size, qty = 1, options = {}) {
  if (!product) return;
  const stock = Number(product.stock);
  if (Number.isFinite(stock) && stock <= 0) {
    showToast("This piece is currently sold out", { type: "error" });
    return;
  }

  const chosenSize = size || defaultSize(product.sizes);
  const key = cartKey(product.id, chosenSize);
  const maxQty = Math.min(MAX_QTY, Number.isFinite(stock) && stock > 0 ? stock : MAX_QTY);
  const quantity = Math.max(1, Math.min(Number(qty) || 1, maxQty));
  const existing = state.cart.find((item) => item.key === key);

  if (existing) {
    const next = Math.min(existing.qty + quantity, maxQty);
    if (next === existing.qty) {
      showToast("You've reached the available quantity", { type: "error" });
      return;
    }
    existing.qty = next;
  } else {
    state.cart.push({
      key,
      id: product.id,
      title: product.title,
      price: Number(product.price) || 0,
      thumbnail: product.thumbnail || (product.images && product.images[0]) || "",
      category: product.category,
      size: chosenSize,
      qty: quantity,
    });
  }

  saveCart();
  renderCart();

  if (options.openCart) openCart();
  showToast(`${product.title} added to your bag`, {
    actionLabel: "View bag",
    action: openCart,
  });
}

function quickAdd(id) {
  const product = findProduct(id);
  if (!product) return;
  addToCart(product, defaultSize(product.sizes), 1);
}

function changeCartQty(key, delta) {
  const item = state.cart.find((entry) => entry.key === key);
  if (!item) return;
  item.qty = Math.max(1, Math.min(item.qty + delta, MAX_QTY));
  saveCart();
  renderCart();
}

function removeCartItem(key) {
  const item = state.cart.find((entry) => entry.key === key);
  state.cart = state.cart.filter((entry) => entry.key !== key);
  saveCart();
  renderCart();
  if (item) showToast(`${item.title} removed from your bag`);
}

function cartItemMarkup(item) {
  return `
    <article class="cart-item" data-cart-key="${esc(item.key)}">
      <button class="cart-item-img" type="button" data-open-product="${item.id}"
        aria-label="View ${esc(item.title)}">
        <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy" decoding="async">
      </button>
      <div class="cart-item-info">
        <p class="cart-item-cat">${esc(catFull(item.category))}</p>
        <button class="cart-item-title" type="button" data-open-product="${item.id}">${esc(item.title)}</button>
        <p class="cart-item-meta">Size: ${esc(item.size)} · ${fmt(item.price)}</p>
        <div class="cart-item-bottom">
          <div class="qty-stepper" aria-label="Quantity for ${esc(item.title)}">
            <button type="button" data-cart-dec="${esc(item.key)}" aria-label="Decrease quantity">
              <svg class="icon"><use href="#i-minus"/></svg>
            </button>
            <span>${item.qty}</span>
            <button type="button" data-cart-inc="${esc(item.key)}" aria-label="Increase quantity">
              <svg class="icon"><use href="#i-plus"/></svg>
            </button>
          </div>
          <strong class="cart-item-price">${fmt(item.price * item.qty)}</strong>
        </div>
        <div class="cart-item-actions">
          <button class="cart-remove" type="button" data-cart-remove="${esc(item.key)}">
            <svg class="icon"><use href="#i-trash"/></svg> Remove
          </button>
        </div>
      </div>
    </article>`;
}

function renderCart() {
  if (!ui.cartDrawer) return;
  const hasItems = state.cart.length > 0;

  if (!hasItems && state.coupon) {
    state.coupon = null;
    storageRemove(STORAGE.coupon);
  }

  if (ui.cartItems) {
    ui.cartItems.innerHTML = hasItems ? state.cart.map(cartItemMarkup).join("") : "";
  }
  if (ui.cartEmpty) ui.cartEmpty.hidden = hasItems;
  if (ui.cartFooter) ui.cartFooter.hidden = !hasItems;
  if (ui.shipMeter) ui.shipMeter.hidden = !hasItems;

  updateCartBadges();
  validateCouponForCart();
  renderCouponUI();

  const totals = computeTotals();

  if (ui.cartSubtotal) ui.cartSubtotal.textContent = fmt(totals.subtotal);
  if (ui.cartDiscount) ui.cartDiscount.textContent = `−${fmt(totals.discount)}`;
  if (ui.discountRow) ui.discountRow.hidden = totals.discount <= 0;
  if (ui.discountLabel) {
    ui.discountLabel.textContent = state.coupon && state.coupon.type === "percent"
      ? `(${state.coupon.code})`
      : "";
  }
  if (ui.cartShipping) {
    ui.cartShipping.textContent = !hasItems
      ? "—"
      : totals.shipping === 0
      ? "Free"
      : fmt(totals.shipping);
    ui.cartShipping.style.color = hasItems && totals.shipping === 0 ? "var(--success)" : "";
  }
  if (ui.cartTotal) ui.cartTotal.textContent = fmt(totals.total);

  if (ui.shipMeter && ui.shipProgress && ui.shipProgressText) {
    const afterDiscount = Math.max(0, totals.subtotal - totals.discount);
    const free = totals.shipping === 0 || afterDiscount >= FREE_SHIPPING_AT;
    const percent = Math.min(100, (afterDiscount / FREE_SHIPPING_AT) * 100);
    ui.shipMeter.classList.toggle("is-free", free);
    ui.shipProgress.style.width = `${free ? 100 : percent}%`;
    ui.shipProgressText.textContent = free
      ? "You've unlocked complimentary shipping"
      : `Add ${fmt(FREE_SHIPPING_AT - afterDiscount)} more for complimentary shipping`;
  }

  if (ui.checkoutBtn) ui.checkoutBtn.disabled = !hasItems;
}

function validateCouponForCart() {
  if (!state.coupon || !state.cart.length) return;
  if (state.coupon.min && cartSubtotal() < state.coupon.min) {
    const removed = state.coupon.code;
    state.coupon = null;
    storageRemove(STORAGE.coupon);
    setCouponMessage(`${removed} was removed — minimum spend not met.`);
  }
}

function setCouponMessage(message, isSuccess = false) {
  if (!ui.couponMsg) return;
  ui.couponMsg.textContent = message || "";
  ui.couponMsg.classList.toggle("is-success", Boolean(isSuccess && message));
}

function renderCouponUI() {
  if (!ui.couponForm) return;
  const applied = Boolean(state.coupon);
  ui.couponForm.hidden = applied;
  if (ui.couponApplied) ui.couponApplied.hidden = !applied;
  if (ui.couponHints) ui.couponHints.hidden = applied;
  if (applied && ui.couponAppliedCode) ui.couponAppliedCode.textContent = state.coupon.code;
}

function applyCoupon(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    setCouponMessage("Enter a coupon code to continue.");
    return false;
  }
  const definition = COUPONS[code];
  if (!definition) {
    setCouponMessage(`“${code}” isn't a valid code. Try WELCOME10.`);
    return false;
  }
  if (!state.cart.length) {
    setCouponMessage("Add a piece to your bag before applying a code.");
    return false;
  }
  const subtotal = cartSubtotal();
  if (definition.min && subtotal < definition.min) {
    setCouponMessage(`Spend ${fmt(definition.min)} to unlock ${code}.`);
    return false;
  }

  state.coupon = { code, ...definition };
  storageSet(STORAGE.coupon, state.coupon);
  if (ui.couponInput) ui.couponInput.value = "";
  setCouponMessage("");
  renderCart();
  showToast(`${code} applied — ${definition.label}`);
  return true;
}

function handleCouponClick(code) {
  if (!state.cart.length) {
    showToast("Your bag is empty — add a piece to use a code", { type: "error" });
    return;
  }
  if (!ui.cartDrawer.classList.contains("is-open")) openCart();
  if (ui.couponInput) ui.couponInput.value = code;
  applyCoupon(code);
}

function removeCoupon() {
  if (!state.coupon) return;
  const code = state.coupon.code;
  state.coupon = null;
  storageRemove(STORAGE.coupon);
  setCouponMessage(`${code} removed.`);
  renderCart();
  showToast("Coupon removed");
}

function openCart() {
  renderCart();
  openLayer(ui.cartDrawer);
}

/* ------------------------------ Wishlist -------------------------------- */
function syncWishUI() {
  const count = state.wishlist.length;
  if (ui.wishCount) {
    ui.wishCount.textContent = String(count);
    ui.wishCount.hidden = count === 0;
  }
  if (ui.wishHeadingCount) {
    ui.wishHeadingCount.textContent = `${count} saved piece${count === 1 ? "" : "s"}`;
  }

  $$("[data-wish-toggle]").forEach((button) => {
    const active = isWished(button.dataset.wishToggle);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Remove from wishlist" : "Save to wishlist");
  });

  if (ui.pmWish && state.modalProductId) {
    const active = isWished(state.modalProductId);
    ui.pmWish.classList.toggle("is-active", active);
    ui.pmWish.setAttribute("aria-pressed", String(active));
    ui.pmWish.setAttribute("aria-label", active ? "Remove from wishlist" : "Save to wishlist");
  }
}

function toggleWishlist(id) {
  const numericId = Number(id);
  const index = state.wishlist.findIndex((item) => item.id === numericId);

  if (index >= 0) {
    const removed = state.wishlist[index];
    state.wishlist.splice(index, 1);
    saveWishlist();
    syncWishUI();
    renderWishlist();
    showToast(`${removed.title} removed from your wishlist`);
    return;
  }

  const product = findProduct(numericId);
  if (!product) return;
  state.wishlist.unshift(snapshotProduct(product));
  saveWishlist();
  syncWishUI();
  renderWishlist();
  showToast(`${product.title} saved to your wishlist`, {
    actionLabel: "View wishlist",
    action: openWishlist,
  });
}

function wishItemMarkup(item) {
  return `
    <article class="wish-item">
      <button class="wish-item-img" type="button" data-open-product="${item.id}"
        aria-label="View ${esc(item.title)}">
        <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy" decoding="async">
      </button>
      <div class="wish-item-info">
        <p class="cart-item-cat">${esc(catFull(item.category))}</p>
        <button class="cart-item-title" type="button" data-open-product="${item.id}">${esc(item.title)}</button>
        <span class="wish-item-price">${fmt(item.price)}</span>
        <div class="wish-item-actions">
          <button class="btn-mini" type="button" data-move-to-cart="${item.id}">
            <svg class="icon"><use href="#i-bag"/></svg> Move to bag
          </button>
          <button class="wish-remove" type="button" data-wish-remove="${item.id}"
            aria-label="Remove ${esc(item.title)} from wishlist">
            <svg class="icon"><use href="#i-trash"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderWishlist() {
  if (!ui.wishDrawer) return;
  const hasItems = state.wishlist.length > 0;
  if (ui.wishItems) {
    ui.wishItems.innerHTML = hasItems ? state.wishlist.map(wishItemMarkup).join("") : "";
  }
  if (ui.wishEmpty) ui.wishEmpty.hidden = hasItems;
  if (ui.wishFooter) ui.wishFooter.hidden = !hasItems;
  syncWishUI();
}

function openWishlist() {
  renderWishlist();
  openLayer(ui.wishDrawer);
}

function moveWishToCart(id) {
  const product = findProduct(id);
  if (!product) return;
  const size = defaultSize(product.sizes);
  addToCart(product, size, 1);
  state.wishlist = state.wishlist.filter((item) => item.id !== Number(id));
  saveWishlist();
  renderWishlist();
}

function removeWish(id) {
  const item = state.wishlist.find((entry) => entry.id === Number(id));
  state.wishlist = state.wishlist.filter((entry) => entry.id !== Number(id));
  saveWishlist();
  renderWishlist();
  if (item) showToast(`${item.title} removed from your wishlist`);
}

/* ------------------------------ Checkout -------------------------------- */
function openCheckout() {
  if (!state.cart.length) {
    showToast("Your bag is empty — add a piece first", { type: "error" });
    return;
  }
  closeLayer(ui.cartDrawer);
  renderCheckoutSummary();
  prefillCheckout();
  clearCheckoutErrors();
  if (ui.coEta) ui.coEta.textContent = deliveryRange();
  openLayer(ui.checkoutModal);
}

function prefillCheckout() {
  const customer = storageGet(STORAGE.customer, null);
  if (!customer) return;
  const mapping = {
    coName: customer.name,
    coEmail: customer.email,
    coPhone: customer.phone,
    coAddress: customer.address,
    coCity: customer.city,
    coZip: customer.zip,
    coCountry: customer.country,
  };
  Object.entries(mapping).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field && !field.value && value) field.value = value;
  });
}

function renderCheckoutSummary() {
  const totals = computeTotals();
  if (ui.coItems) {
    ui.coItems.innerHTML = state.cart
      .map(
        (item) => `
        <div class="co-item">
          <span class="co-item-img">
            <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy">
          </span>
          <div class="co-item-info">
            <p class="co-item-title">${esc(item.title)}</p>
            <p class="co-item-meta">Size ${esc(item.size)} · Qty ${item.qty}</p>
          </div>
          <span class="co-item-price">${fmt(item.price * item.qty)}</span>
        </div>`
      )
      .join("");
  }

  if (ui.coSubtotal) ui.coSubtotal.textContent = fmt(totals.subtotal);
  if (ui.coDiscount) ui.coDiscount.textContent = `−${fmt(totals.discount)}`;
  if (ui.coDiscountRow) ui.coDiscountRow.hidden = totals.discount <= 0;
  if (ui.coShipping) {
    ui.coShipping.textContent = totals.shipping === 0 ? "Free" : fmt(totals.shipping);
    ui.coShipping.style.color = totals.shipping === 0 ? "var(--success)" : "";
  }
  if (ui.coTotal) ui.coTotal.textContent = fmt(totals.total);
}

function clearCheckoutErrors() {
  $$(".field", ui.checkoutForm).forEach((field) => {
    field.classList.remove("has-error");
    const error = $(".field-error", field);
    if (error) error.textContent = "";
  });
}

function validateCheckout() {
  const checks = [
    { id: "coName", test: (value) => value.trim().length >= 2, message: "Please enter your full name." },
    {
      id: "coEmail",
      test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()),
      message: "Enter a valid email address.",
    },
    {
      id: "coPhone",
      test: (value) => value.replace(/[^\d]/g, "").length >= 7,
      message: "Enter a valid phone number.",
    },
    { id: "coCity", test: (value) => value.trim().length >= 2, message: "Please enter your city." },
    { id: "coAddress", test: (value) => value.trim().length >= 5, message: "Please enter your delivery address." },
    { id: "coZip", test: (value) => value.trim().length >= 3, message: "Enter a valid postcode / ZIP." },
    { id: "coCountry", test: (value) => Boolean(value), message: "Please select a country." },
  ];

  let valid = true;
  let firstInvalid = null;

  checks.forEach((check) => {
    const input = document.getElementById(check.id);
    if (!input) return;
    const field = input.closest(".field");
    const error = field ? $(".field-error", field) : null;
    const passed = check.test(input.value || "");

    if (field) field.classList.toggle("has-error", !passed);
    if (error) error.textContent = passed ? "" : check.message;

    if (!passed) {
      valid = false;
      if (!firstInvalid) firstInvalid = input;
    }
  });

  if (firstInvalid) firstInvalid.focus();
  return valid;
}

function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (!state.cart.length) {
    showToast("Your bag is empty", { type: "error" });
    closeLayer(ui.checkoutModal);
    return;
  }
  if (!validateCheckout()) {
    showToast("Please check the highlighted fields", { type: "error" });
    return;
  }

  const data = Object.fromEntries(new FormData(ui.checkoutForm).entries());
  const totals = computeTotals();
  const now = new Date();
  const orderNumber = `STK-${String(now.getTime()).slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

  const order = {
    id: orderNumber,
    date: now.toISOString(),
    customer: {
      name: String(data.name || "").trim(),
      email: String(data.email || "").trim(),
      phone: String(data.phone || "").trim(),
      address: String(data.address || "").trim(),
      city: String(data.city || "").trim(),
      zip: String(data.zip || "").trim(),
      country: String(data.country || "").trim(),
      notes: String(data.notes || "").trim(),
    },
    payment: data.payment || "Card",
    items: state.cart.map((item) => ({ ...item })),
    totals,
    coupon: state.coupon ? state.coupon.code : null,
    eta: deliveryRange(),
  };

  const orders = storageGet(STORAGE.orders, []);
  const orderList = Array.isArray(orders) ? orders : [];
  orderList.unshift(order);
  storageSet(STORAGE.orders, orderList.slice(0, 25));
  storageSet(STORAGE.customer, order.customer);

  state.cart = [];
  state.coupon = null;
  saveCart();
  storageRemove(STORAGE.coupon);
  renderCart();

  closeLayer(ui.checkoutModal);
  populateOrderModal(order);
  openLayer(ui.orderModal);
}

function populateOrderModal(order) {
  if (ui.orderNumber) ui.orderNumber.textContent = order.id;
  if (ui.orderEmail) ui.orderEmail.textContent = order.customer.email;
  if (ui.orderEta) ui.orderEta.textContent = order.eta;
  if (ui.orderPayment) ui.orderPayment.textContent = order.payment;
  if (ui.orderTotal) ui.orderTotal.textContent = fmt(order.totals.total);
  if (ui.orderItems) {
    ui.orderItems.innerHTML = order.items
      .map(
        (item) => `
        <div class="order-item">
          <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy">
          <span>${esc(item.title)}</span>
          <em>×${item.qty}</em>
        </div>`
      )
      .join("");
  }
}

/* ==========================================================================
   Modals, layers, search, newsletter, toast, events
   ========================================================================== */

function refreshAOS() {
  if (!window.AOS) return;
  window.clearTimeout(state.aosTimer);
  state.aosTimer = window.setTimeout(() => {
    try {
      window.AOS.refreshHard();
    } catch (error) {
      /* ignore */
    }
  }, 80);
}

/* ------------------------------- Toast ---------------------------------- */
function showToast(message, options = {}) {
  if (!ui.toast) return;
  window.clearTimeout(state.toastTimer);

  const type = options.type === "error" ? "error" : "success";
  ui.toastText.textContent = message;
  ui.toast.classList.toggle("is-error", type === "error");

  const iconUse = ui.toast.querySelector(".toast-icon use");
  if (iconUse) iconUse.setAttribute("href", type === "error" ? "#i-close" : "#i-check");

  if (options.actionLabel && typeof options.action === "function") {
    ui.toastAction.hidden = false;
    ui.toastAction.textContent = options.actionLabel;
    state.toastAction = options.action;
  } else {
    ui.toastAction.hidden = true;
    state.toastAction = null;
  }

  ui.toast.classList.remove("is-visible");
  void ui.toast.offsetWidth;
  ui.toast.classList.add("is-visible");

  state.toastTimer = window.setTimeout(() => {
    ui.toast.classList.remove("is-visible");
    state.toastAction = null;
  }, 3400);
}

/* ------------------------- Layers & accessibility ----------------------- */
function syncLayerTriggers() {
  const pairs = [
    [ui.mobileMenu, ui.menuBtn],
    [ui.searchPanel, ui.searchBtn],
    [ui.cartDrawer, ui.cartBtn],
    [ui.wishDrawer, ui.wishBtn],
  ];
  pairs.forEach(([layer, trigger]) => {
    if (!layer || !trigger) return;
    trigger.setAttribute("aria-expanded", String(layer.classList.contains("is-open")));
  });
}

function openLayer(layer) {
  if (!layer) return;
  layer.classList.add("is-open");
  layer.setAttribute("aria-hidden", "false");
  state.lastFocus = document.activeElement;
  document.body.classList.add("no-scroll");
  syncLayerTriggers();

  if (layer === ui.searchPanel) {
    window.setTimeout(() => {
      if (ui.overlaySearchInput) {
        ui.overlaySearchInput.value = state.search;
        ui.overlaySearchInput.focus();
      }
    }, 140);
    return;
  }

  const focusTarget =
    layer.querySelector("[data-autofocus]") ||
    layer.querySelector(
      "button:not([disabled]), [href], input:not([disabled]), select, textarea"
    );
  if (focusTarget) {
    window.setTimeout(() => {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }, 140);
  }
}

function closeLayer(layer) {
  if (!layer || !layer.classList.contains("is-open")) return;

  if (layer.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  layer.classList.remove("is-open");
  layer.setAttribute("aria-hidden", "true");

  const previous = state.lastFocus;
  if (
    previous &&
    document.contains(previous) &&
    !previous.closest('[aria-hidden="true"]') &&
    previous.offsetParent !== null &&
    typeof previous.focus === "function"
  ) {
    try {
      previous.focus({ preventScroll: true });
    } catch (error) {
      /* ignore */
    }
  }

  if (!document.querySelector(".drawer.is-open, .modal.is-open, .search-panel.is-open")) {
    document.body.classList.remove("no-scroll");
  }
  syncLayerTriggers();
}

function closeTopmost() {
  const layers = [
    ui.orderModal,
    ui.checkoutModal,
    ui.sizeModal,
    ui.productModal,
    ui.searchPanel,
    ui.wishDrawer,
    ui.cartDrawer,
    ui.mobileMenu,
  ];
  const open = layers.find((layer) => layer && layer.classList.contains("is-open"));
  if (open) closeLayer(open);
}

function trapFocus(event) {
  const layer = document.querySelector(".modal.is-open, .drawer.is-open, .search-panel.is-open");
  if (!layer) return;

  const focusables = Array.from(
    layer.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);

  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* --------------------------- Product modal ------------------------------ */
function openProduct(id) {
  const product = findProduct(id);
  if (!product) {
    showToast("That piece is no longer available", { type: "error" });
    return;
  }

  state.modalProductId = product.id;
  state.modalSize = defaultSize(product.sizes);
  state.modalQty = 1;

  const discount = Math.round(product.discountPercentage || 0);
  const categoryText = product.brand
    ? `${catFull(product.category)} · ${product.brand}`
    : catFull(product.category);

  if (ui.pmCategory) ui.pmCategory.textContent = categoryText;
  if (ui.pmTitle) ui.pmTitle.textContent = product.title;
  if (ui.pmStars) ui.pmStars.style.setProperty("--rating", product.rating);
  if (ui.pmRating) ui.pmRating.textContent = product.rating.toFixed(1);
  if (ui.pmStock) {
    ui.pmStock.textContent =
      product.stock <= 0
        ? "Sold out"
        : product.stock <= 5
        ? `Only ${product.stock} left`
        : "In stock";
  }
  if (ui.pmPrice) ui.pmPrice.textContent = fmt(product.price);
  if (ui.pmOld) {
    ui.pmOld.textContent = product.originalPrice ? fmt(product.originalPrice) : "";
    ui.pmOld.hidden = !product.originalPrice;
  }
  if (ui.pmDiscount) {
    ui.pmDiscount.textContent = discount >= 1 ? `-${discount}%` : "";
    ui.pmDiscount.hidden = discount < 1;
  }
  if (ui.pmBadge) {
    ui.pmBadge.textContent = discount >= 1 ? `-${discount}%` : "";
    ui.pmBadge.hidden = discount < 1;
  }
  if (ui.pmDesc) ui.pmDesc.textContent = product.description || "";
  if (ui.pmMainImg) {
    ui.pmMainImg.src = product.images[0] || product.thumbnail || "";
    ui.pmMainImg.alt = product.title;
  }

  if (ui.pmSizes) {
    ui.pmSizes.innerHTML = (product.sizes || ["One Size"])
      .map(
        (size) => `
        <button class="size-option ${size === state.modalSize ? "is-active" : ""}"
          type="button" data-size="${esc(size)}" aria-pressed="${size === state.modalSize}">
          ${esc(size)}
        </button>`
      )
      .join("");
  }

  if (ui.pmThumbs) {
    ui.pmThumbs.innerHTML = (product.images || [product.thumbnail])
      .slice(0, 5)
      .map(
        (image, index) => `
        <button class="pm-thumb ${index === 0 ? "is-active" : ""}" type="button"
          data-thumb-index="${index}" aria-label="View image ${index + 1} of ${product.title}">
          <img src="${esc(image)}" alt="" loading="lazy">
        </button>`
      )
      .join("");
  }

  if (ui.pmAdd) {
    ui.pmAdd.innerHTML = state.pmAddMarkup || "Add to bag";
    ui.pmAdd.disabled = product.stock <= 0;
    if (product.stock <= 0) ui.pmAdd.textContent = "Sold out";
  }

  setModalQty(1);
  syncWishUI();
  openLayer(ui.productModal);
}

function setModalQty(next) {
  const product = state.modalProductId ? findProduct(state.modalProductId) : null;
  const max = Math.max(1, Math.min(MAX_QTY, product?.stock || MAX_QTY));
  state.modalQty = Math.max(1, Math.min(Number(next) || 1, max));

  if (ui.pmQty) ui.pmQty.textContent = String(state.modalQty);
  if (ui.pmQtyMinus) ui.pmQtyMinus.disabled = state.modalQty <= 1;
  if (ui.pmQtyPlus) ui.pmQtyPlus.disabled = state.modalQty >= max;
}

function addFromModal() {
  const product = state.modalProductId ? findProduct(state.modalProductId) : null;
  if (!product || product.stock <= 0) return;

  addToCart(product, state.modalSize, state.modalQty);

  if (ui.pmAdd) {
    ui.pmAdd.innerHTML = '<svg class="icon"><use href="#i-check"/></svg> Added to bag';
    ui.pmAdd.disabled = true;
    window.setTimeout(() => {
      ui.pmAdd.innerHTML = state.pmAddMarkup || "Add to bag";
      ui.pmAdd.disabled = false;
    }, 1300);
  }
}

/* ------------------------------ Search ---------------------------------- */
function openSearch() {
  openLayer(ui.searchPanel);
}

function runSearch(query, options = {}) {
  state.search = String(query || "").trim();
  if (options.resetCategory) state.category = "all";
  state.visible = PAGE_SIZE;

  if (ui.searchInput) ui.searchInput.value = state.search;
  if (ui.overlaySearchInput) ui.overlaySearchInput.value = state.search;

  if (ui.searchPanel.classList.contains("is-open")) closeLayer(ui.searchPanel);
  applyFilters(true);
  if (!state.loading && !state.error && state.search) {
    scrollToSection("trending");
    showToast(`Showing results for “${state.search}”`);
  }
}

/* ---------------------------- Newsletter -------------------------------- */
function handleNewsletterSubmit(event) {
  event.preventDefault();
  const email = (ui.newsletterEmail?.value || "").trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  if (!valid) {
    if (ui.newsletterMsg) {
      ui.newsletterMsg.textContent = "Please enter a valid email address.";
      ui.newsletterMsg.classList.add("is-error");
    }
    ui.newsletterEmail?.setAttribute("aria-invalid", "true");
    ui.newsletterEmail?.focus();
    return;
  }

  ui.newsletterEmail?.removeAttribute("aria-invalid");
  if (ui.newsletterMsg) ui.newsletterMsg.classList.remove("is-error");

  const subscribers = storageGet(STORAGE.subscribers, []);
  const list = Array.isArray(subscribers) ? subscribers : [];
  const normalized = email.toLowerCase();

  if (list.includes(normalized)) {
    if (ui.newsletterMsg) {
      ui.newsletterMsg.textContent = "You're already on the list — your code is WELCOME10.";
    }
  } else {
    list.push(normalized);
    storageSet(STORAGE.subscribers, list);
    if (ui.newsletterMsg) {
      ui.newsletterMsg.textContent = "You're in — check your inbox for your 10% welcome code.";
    }
    showToast("Welcome to the inner circle");
  }

  if (ui.newsletterEmail) ui.newsletterEmail.value = "";
}

/* ------------------------------ Events ---------------------------------- */
function bindEvents() {
  ui.cartBtn?.addEventListener("click", openCart);
  ui.wishBtn?.addEventListener("click", openWishlist);
  ui.menuBtn?.addEventListener("click", () => openLayer(ui.mobileMenu));
  ui.searchBtn?.addEventListener("click", openSearch);
  ui.searchClose?.addEventListener("click", () => closeLayer(ui.searchPanel));
  ui.mobileMenuClose?.addEventListener("click", () => closeLayer(ui.mobileMenu));

  ui.sortSelect?.addEventListener("change", () => {
    state.sort = ui.sortSelect.value;
    state.visible = PAGE_SIZE;
    applyFilters(true);
  });

  ui.trendingSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.search = ui.searchInput ? ui.searchInput.value : "";
    state.visible = PAGE_SIZE;
    applyFilters(true);
  });

  ui.searchInput?.addEventListener("input", () => {
    syncSearchClear();
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      state.search = ui.searchInput.value;
      state.visible = PAGE_SIZE;
      applyFilters(true);
    }, 220);
  });

  ui.searchClear?.addEventListener("click", () => {
    state.search = "";
    if (ui.searchInput) {
      ui.searchInput.value = "";
      ui.searchInput.focus();
    }
    syncSearchClear();
    applyFilters(true);
  });

  ui.searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(ui.overlaySearchInput?.value || "", { resetCategory: true });
  });

  ui.searchPanel?.addEventListener("click", (event) => {
    if (event.target === ui.searchPanel) closeLayer(ui.searchPanel);
  });

  ui.couponForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyCoupon(ui.couponInput ? ui.couponInput.value : "");
  });

  ui.couponRemove?.addEventListener("click", removeCoupon);
  ui.checkoutBtn?.addEventListener("click", openCheckout);
  ui.checkoutForm?.addEventListener("submit", handleCheckoutSubmit);

  ui.orderContinue?.addEventListener("click", () => {
    closeLayer(ui.orderModal);
    scrollToSection("trending");
    showToast("Thank you for shopping with Stackly");
  });

  ui.sizeGuideBtn?.addEventListener("click", () => openLayer(ui.sizeModal));

  ui.loadMoreBtn?.addEventListener("click", loadMore);

  ui.toastAction?.addEventListener("click", () => {
    const action = state.toastAction;
    window.clearTimeout(state.toastTimer);
    ui.toast.classList.remove("is-visible");
    state.toastAction = null;
    if (typeof action === "function") action();
  });

  ui.pmQtyMinus?.addEventListener("click", () => setModalQty(state.modalQty - 1));
  ui.pmQtyPlus?.addEventListener("click", () => setModalQty(state.modalQty + 1));
  ui.pmAdd?.addEventListener("click", addFromModal);
  ui.pmWish?.addEventListener("click", () => {
    if (state.modalProductId) toggleWishlist(state.modalProductId);
  });

  ui.pmSizes?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    state.modalSize = button.dataset.size;
    $$(".size-option", ui.pmSizes).forEach((option) => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", String(active));
    });
  });

  ui.pmThumbs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-thumb-index]");
    if (!button) return;
    const product = findProduct(state.modalProductId);
    if (!product) return;
    const image = product.images[Number(button.dataset.thumbIndex)];
    if (!image) return;
    if (ui.pmMainImg) {
      ui.pmMainImg.src = image;
      ui.pmMainImg.alt = product.title;
    }
    $$(".pm-thumb", ui.pmThumbs).forEach((thumb) => {
      thumb.classList.toggle("is-active", thumb === button);
    });
  });

  ui.newsletterForm?.addEventListener("submit", handleNewsletterSubmit);

  $$(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeLayer(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTopmost();
    if (event.key === "Tab") trapFocus(event);
  });

  document.addEventListener("click", handleDelegatedClick);

  window.addEventListener(
    "scroll",
    () => {
      ui.header?.classList.toggle("is-scrolled", window.scrollY > 12);
    },
    { passive: true }
  );
}

function handleDelegatedClick(event) {
  const target = event.target;

  const scrim = target.closest("[data-close-layer]");
  if (scrim) {
    closeLayer(scrim.closest(".drawer") || scrim.closest(".modal") || scrim.closest(".search-panel"));
    return;
  }

  const closeProduct = target.closest("[data-close-product]");
  if (closeProduct) {
    closeLayer(ui.productModal);
    return;
  }

  const sizeTrigger = target.closest("[data-open-size]");
  if (sizeTrigger) {
    event.preventDefault();
    openLayer(ui.sizeModal);
    return;
  }

  const placeholderLink = target.closest('a[href="#"]');
  if (placeholderLink) event.preventDefault();
  const closeCheckout = target.closest("[data-close-checkout]");
  if (closeCheckout) {
    closeLayer(ui.checkoutModal);
    return;
  }
  const closeSize = target.closest("[data-close-size]");
  if (closeSize) {
    closeLayer(ui.sizeModal);
    return;
  }

  const closeCart = target.closest("[data-close-cart]");
  if (closeCart) closeLayer(ui.cartDrawer);

  const closeWish = target.closest("[data-close-wish]");
  if (closeWish) closeLayer(ui.wishDrawer);

  const goto = target.closest("[data-goto]");
  if (goto) {
    const id = String(goto.dataset.goto || "").replace("#", "");
    window.setTimeout(() => scrollToSection(id), 180);
  }

  const openProductButton = target.closest("[data-open-product]");
  if (openProductButton) {
    event.preventDefault();
    openProduct(openProductButton.dataset.openProduct);
    return;
  }

  const wishButton = target.closest("[data-wish-toggle]");
  if (wishButton) {
    event.preventDefault();
    toggleWishlist(wishButton.dataset.wishToggle);
    return;
  }

  const quickButton = target.closest("[data-quick-add]");
  if (quickButton) {
    event.preventDefault();
    quickAdd(quickButton.dataset.quickAdd);
    return;
  }

  const categoryButton = target.closest("[data-category]");
  if (categoryButton) {
    event.preventDefault();
    const inMenu = Boolean(categoryButton.closest("#mobileMenu"));
    const isCard = categoryButton.classList.contains("category-card");
    applyCategory(categoryButton.dataset.category, {
      closeMenu: inMenu,
      scroll: inMenu || isCard,
    });
    return;
  }

  const filterLink = target.closest("[data-filter-cat]");
  if (filterLink) {
    event.preventDefault();
    applyCategory(filterLink.dataset.filterCat, {
      closeMenu: Boolean(filterLink.closest("#mobileMenu")),
      scroll: true,
    });
    return;
  }

  const searchChip = target.closest("[data-search-chip]");
  if (searchChip) {
    event.preventDefault();
    runSearch(searchChip.dataset.searchChip, { resetCategory: true });
    return;
  }

  const couponTrigger = target.closest("[data-coupon]");
  if (couponTrigger) {
    event.preventDefault();
    handleCouponClick(couponTrigger.dataset.coupon);
    return;
  }

  const inc = target.closest("[data-cart-inc]");
  if (inc) {
    changeCartQty(inc.dataset.cartInc, 1);
    return;
  }

  const dec = target.closest("[data-cart-dec]");
  if (dec) {
    changeCartQty(dec.dataset.cartDec, -1);
    return;
  }

  const removeFromCart = target.closest("[data-cart-remove]");
  if (removeFromCart) {
    removeCartItem(removeFromCart.dataset.cartRemove);
    return;
  }

  const moveToCart = target.closest("[data-move-to-cart]");
  if (moveToCart) {
    moveWishToCart(moveToCart.dataset.moveToCart);
    return;
  }

  const removeFromWish = target.closest("[data-wish-remove]");
  if (removeFromWish) {
    removeWish(removeFromWish.dataset.wishRemove);
    return;
  }

  const retry = target.closest("[data-retry]");
  if (retry) {
    loadProducts();
    return;
  }

  const reset = target.closest("[data-reset-filters]");
  if (reset) {
    resetFilters();
    return;
  }

  const menuLink = target.closest("[data-menu-link]");
  if (menuLink) {
    closeLayer(ui.mobileMenu);
  }
}

/* ---------------------------- Scroll spy -------------------------------- */
function setupScrollSpy() {
  const links = $$(".nav-link");
  const map = new Map();
  links.forEach((link) => {
    const id = (link.getAttribute("href") || "").replace("#", "");
    if (id) map.set(id, link);
  });

  const sections = Array.from(map.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("is-active"));
        const link = map.get(entry.target.id);
        if (link) link.classList.add("is-active");
      });
    },
    { rootMargin: "-42% 0px -52% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* ------------------------------- Init ----------------------------------- */
function setYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function init() {
  cacheDom();
  hydrateStorage();
  setYear();

  state.pmAddMarkup = ui.pmAdd ? ui.pmAdd.innerHTML : "Add to bag";

  if (window.AOS) {
    window.AOS.init({
      duration: 750,
      easing: "ease-out-cubic",
      once: true,
      offset: 60,
      disable: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  } else {
    $$("[data-aos]").forEach((element) => element.removeAttribute("data-aos"));
  }

  bindEvents();
  setupScrollSpy();
  renderCart();
  renderWishlist();
  loadProducts();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}


