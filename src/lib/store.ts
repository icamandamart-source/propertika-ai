import { useSyncExternalStore } from 'react';
import type {
  AccountData,
  Address,
  AuthUser,
  Banner,
  CartItem,
  GeoCoords,
  Inquiry,
  Listing,
  Order,
  OrderStatus,
  PlatformData,
  ProductReview,
  Profile,
  SellerProfile,
  SharedPlatform,
  ShoppingData,
  StoreInfo,
  Toast,
  UserRole,
  Voucher,
} from '../types';
import {
  LISTING_CATEGORIES,
  MAX_GALLERY_IMAGES,
  ORDER_STATUSES,
} from '../types';
import { SEED_LISTINGS } from '../data/seed';
import { SEED_BANNERS, SEED_REVIEWS, SEED_VOUCHERS } from '../data/promos';
import { notifyIncomingMessage } from './notifications';
import { createOrderOnServer } from './orders-api';
import { normalizeCoords } from './geo';
import {
  deleteInquiry as deleteCloudInquiry,
  deleteListing as deleteCloudListing,
  firestoreEnabled,
  isAdminUser,
  migrateListings,
  migrateOrders,
  saveAccount as saveCloudAccount,
  saveInquiry as saveCloudInquiry,
  saveListing as saveCloudListing,
  savePlatform as saveCloudPlatform,
  saveReview as saveCloudReview,
  subscribeAccount,
  subscribeAllOrders,
  subscribeBuyerOrders,
  subscribeInquiries,
  subscribeListings,
  subscribePlatform,
  subscribeReviews,
  subscribeSellerOrders,
  updateInquiryRead as updateCloudInquiryRead,
  updateOrderStatus as updateCloudOrderStatus,
} from './firestore';
import {
  calculateTotals,
  hydrateCart,
  isFlashAvailable,
  mergeCarts,
  stockOf,
  storeNameOf,
  unique,
  voucherEligible,
} from './marketplace';

const STORAGE_KEY = 'propertika:v1';
const GUEST_UID = 'guest';

/* ------------------------------------------------------------------ *
 * Bentuk state
 * ------------------------------------------------------------------ */

interface PersistedState {
  accounts: Record<string, AccountData>;
  /** Listing dari format penyimpanan versi lama (sebelum ada akun). */
  legacyListings: Listing[];
  /** Keranjang/alamat/voucher untuk pengunjung yang belum masuk. */
  guest: ShoppingData;
  /** Promo, pesanan, dan pengaturan admin yang dibagi di peramban ini. */
  platform: PlatformData;
}

interface AppState extends PersistedState {
  activeUid: string | null;
  /** Peran yang dipakai saat akun baru sedang didaftarkan (belum tersimpan). */
  pendingRole: UserRole | null;
  toast: Toast | null;
  /** Hasil sinkronisasi katalog Firestore; null berarti masih memakai data lokal. */
  cloudListings: Listing[] | null;
  /** Hasil sinkronisasi pesanan Firestore; null berarti masih memakai data lokal. */
  cloudOrders: Order[] | null;
  /** Pesan masuk dari Firestore untuk akun ini; null berarti belum termuat. */
  cloudInquiries: Inquiry[] | null;
  /** Pengaturan promo/katalog dari Firestore; null berarti belum termuat. */
  cloudPlatform: SharedPlatform | null;
  /** Ulasan publik dari Firestore; null berarti belum termuat. */
  cloudReviews: ProductReview[] | null;
  /** True bila dokumen `admins/{uid}` ada. Hanya untuk tampilan; aturan tetap di rules. */
  cloudAdmin: boolean;
  /** True setelah pemeriksaan admin Firestore selesai. */
  cloudAdminReady: boolean;
}

/** Bentuk data yang dibaca komponen lewat `useAppState()`. */
export interface AppView {
  /** Katalog lengkap: properti contoh + listing semua akun di peramban ini. */
  listings: Listing[];
  favorites: string[];
  inquiries: Inquiry[];
  unreadInquiriesCount: number;
  profile: Profile;
  /** Peran akun yang sedang masuk; null kalau belum masuk. */
  role: UserRole | null;
  /** Profil penjual bila akun sudah melengkapi kriteria penjual. */
  seller: SellerProfile | null;
  toast: Toast | null;
  uid: string | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  adminReady: boolean;
  /* Belanja */
  cart: CartItem[];
  cartCount: number;
  addresses: Address[];
  claimedVoucherCodes: string[];
  orders: Order[];
  platformOrders: Order[];
  vouchers: Voucher[];
  banners: Banner[];
  reviews: ProductReview[];
  stores: StoreInfo[];
  categories: { name: string; label: string }[];
}

const SEED_IDS = new Set(SEED_LISTINGS.map((listing) => listing.id));

const GUEST_PROFILE: Profile = { name: 'Tamu', email: '', phone: '' };

function emptyShopping(): ShoppingData {
  return { cart: [], addresses: [], claimedVoucherCodes: [] };
}

function emptyPlatform(): PlatformData {
  return {
    vouchers: [],
    banners: [],
    orders: [],
    reviews: [],
    listingOverrides: {},
    categoryLabels: {},
    hiddenCategories: [],
  };
}

function emptyAccount(user: AuthUser | null, role: UserRole = 'buyer'): AccountData {
  return {
    role,
    listings: [],
    favorites: [],
    inquiries: [],
    profile: {
      name: user?.displayName || 'Pengguna',
      email: user?.email || '',
      phone: '',
      address: '',
      coords: null,
    },
    ...emptyShopping(),
  };
}

/* ------------------------------------------------------------------ *
 * Normalisasi data tersimpan (kompatibel dengan versi lama)
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSeller(raw: unknown): SellerProfile | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    businessName: typeof raw.businessName === 'string' ? raw.businessName : '',
    sellerType: typeof raw.sellerType === 'string' ? (raw.sellerType as SellerProfile['sellerType']) : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    city: typeof raw.city === 'string' ? raw.city : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    npwp: typeof raw.npwp === 'string' ? raw.npwp : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    coords: normalizeCoords(raw.coords),
  };
}

function normalizeListing(raw: unknown): Listing | null {
  if (!isRecord(raw)) return null;
  const images = Array.isArray(raw.images)
    ? raw.images
        .filter((src): src is string => typeof src === 'string' && src.trim() !== '')
        .slice(0, MAX_GALLERY_IMAGES)
    : [];
  return {
    ...(raw as unknown as Listing),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    images,
  };
}

function normalizeCartItem(raw: unknown): CartItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.listingId !== 'string' || !raw.listingId) return null;
  const qty = typeof raw.qty === 'number' && raw.qty > 0 ? Math.floor(raw.qty) : 1;
  const variation = typeof raw.variation === 'string' ? raw.variation : undefined;
  return {
    id: typeof raw.id === 'string' ? raw.id : `${raw.listingId}${variation ? `::${variation}` : ''}`,
    listingId: raw.listingId,
    qty,
    variation,
    selected: raw.selected !== false,
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date().toISOString(),
  };
}

function normalizeAddress(raw: unknown): Address | null {
  if (!isRecord(raw)) return null;
  const detail = typeof raw.detail === 'string' ? raw.detail : '';
  const recipient = typeof raw.recipient === 'string' ? raw.recipient : '';
  if (!detail && !recipient) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : `addr-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof raw.label === 'string' ? raw.label : 'Rumah',
    recipient,
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    detail,
    city: typeof raw.city === 'string' ? raw.city : '',
    postalCode: typeof raw.postalCode === 'string' ? raw.postalCode : undefined,
    coords: normalizeCoords(raw.coords),
    isDefault: raw.isDefault === true,
  };
}

function normalizeVoucher(raw: unknown): Voucher | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.code !== 'string' || !raw.code) return null;
  const type = raw.type === 'ongkir' || raw.type === 'cashback' ? raw.type : 'diskon';
  return {
    id: typeof raw.id === 'string' ? raw.id : `voucher-${raw.code.toLowerCase()}`,
    code: raw.code.toUpperCase(),
    title: typeof raw.title === 'string' ? raw.title : raw.code,
    type,
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    percent: typeof raw.percent === 'number' ? raw.percent : undefined,
    maxDiscount: typeof raw.maxDiscount === 'number' ? raw.maxDiscount : undefined,
    minSpend: typeof raw.minSpend === 'number' ? raw.minSpend : 0,
    description: typeof raw.description === 'string' ? raw.description : '',
    expiry: typeof raw.expiry === 'string' ? raw.expiry : '2099-12-31',
    storeName: typeof raw.storeName === 'string' ? raw.storeName : undefined,
    color: raw.color === 'navy' || raw.color === 'amber' || raw.color === 'rose' ? raw.color : 'brand',
  };
}

function normalizeBanner(raw: unknown): Banner | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== 'string' || !raw.title) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : `banner-${Math.random().toString(36).slice(2, 8)}`,
    title: raw.title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    cta: typeof raw.cta === 'string' ? raw.cta : 'Lihat',
    to: typeof raw.to === 'string' ? raw.to : '/properti',
    badge: typeof raw.badge === 'string' ? raw.badge : undefined,
    tone: raw.tone === 'brand' || raw.tone === 'navy' || raw.tone === 'dark' || raw.tone === 'amber' ? raw.tone : 'dark',
  };
}

function normalizeReview(raw: unknown): ProductReview | null {
  if (!isRecord(raw)) return null;
if (typeof raw.listingId !== 'string' || typeof raw.comment !== 'string') return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : `review-${Math.random().toString(36).slice(2, 8)}`,
    listingId: raw.listingId,
    orderId: typeof raw.orderId === 'string' ? raw.orderId : undefined,
    name: typeof raw.name === 'string' ? raw.name : 'Pembeli',
    rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(1, Math.round(raw.rating))) : 5,
    comment: raw.comment,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function normalizeOrderItem(raw: unknown): Order['items'][number] | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.listingId !== 'string' || typeof raw.title !== 'string') return null;
  return {
    listingId: raw.listingId,
    title: raw.title,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    price: typeof raw.price === 'number' ? raw.price : 0,
    qty: typeof raw.qty === 'number' && raw.qty > 0 ? Math.floor(raw.qty) : 1,
    variation: typeof raw.variation === 'string' ? raw.variation : undefined,
    isFlash: raw.isFlash === true,
    ownerId: typeof raw.ownerId === 'string' ? raw.ownerId : '',
    ownerName: typeof raw.ownerName === 'string' ? raw.ownerName : '',
    category: typeof raw.category === 'string' ? raw.category : '',
  };
}

function normalizeOrder(raw: unknown): Order | null {
  if (!isRecord(raw)) return null;
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeOrderItem).filter((item): item is Order['items'][number] => Boolean(item))
    : [];
  if (items.length === 0) return null;
  const status = ORDER_STATUSES.includes(raw.status as OrderStatus) ? (raw.status as OrderStatus) : 'belum-dibayar';
  return {
    id: typeof raw.id === 'string' ? raw.id : `order-${Math.random().toString(36).slice(2, 10)}`,
code: typeof raw.code === 'string' ? raw.code : `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    items,
    listingIds: Array.isArray(raw.listingIds)
      ? raw.listingIds.filter((id): id is string => typeof id === 'string')
      : Array.from(new Set(items.map((item) => item.listingId))),
    subtotal: typeof raw.subtotal === 'number' ? raw.subtotal : 0,
    discount: typeof raw.discount === 'number' ? raw.discount : 0,
    shipping: typeof raw.shipping === 'number' ? raw.shipping : 0,
    cashback: typeof raw.cashback === 'number' ? raw.cashback : 0,
    voucherCode: typeof raw.voucherCode === 'string' ? raw.voucherCode : undefined,
    total: typeof raw.total === 'number' ? raw.total : 0,
    status,
    recipient: typeof raw.recipient === 'string' ? raw.recipient : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    city: typeof raw.city === 'string' ? raw.city : '',
shippingMethod: typeof raw.shippingMethod === 'string' ? raw.shippingMethod : 'Reguler',
    shippingMethodId: typeof raw.shippingMethodId === 'string' ? raw.shippingMethodId : undefined,
    paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod : 'Transfer Bank BCA',
    paymentMethodId: typeof raw.paymentMethodId === 'string' ? raw.paymentMethodId : undefined,
    paymentProvider: typeof raw.paymentProvider === 'string' ? raw.paymentProvider : undefined,
    paymentStatus:
      raw.paymentStatus === 'paid' || raw.paymentStatus === 'failed' || raw.paymentStatus === 'pending'
        ? raw.paymentStatus
        : undefined,
    paymentRef: typeof raw.paymentRef === 'string' ? raw.paymentRef : undefined,
    paymentUrl: typeof raw.paymentUrl === 'string' ? raw.paymentUrl : undefined,
    paymentType: typeof raw.paymentType === 'string' ? raw.paymentType : undefined,
    paymentCreatedAt: typeof raw.paymentCreatedAt === 'string' ? raw.paymentCreatedAt : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    buyerUid: typeof raw.buyerUid === 'string' ? raw.buyerUid : GUEST_UID,
    buyerName: typeof raw.buyerName === 'string' ? raw.buyerName : 'Pembeli',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    paidAt: typeof raw.paidAt === 'string' ? raw.paidAt : undefined,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : undefined,
  };
}

function normalizeShopping(raw: unknown): ShoppingData {
  if (!isRecord(raw)) return emptyShopping();
  return {
    cart: Array.isArray(raw.cart)
      ? raw.cart.map(normalizeCartItem).filter((item): item is CartItem => Boolean(item))
      : [],
    addresses: Array.isArray(raw.addresses)
      ? raw.addresses.map(normalizeAddress).filter((item): item is Address => Boolean(item))
      : [],
    claimedVoucherCodes: Array.isArray(raw.claimedVoucherCodes)
      ? raw.claimedVoucherCodes.filter((code): code is string => typeof code === 'string')
      : [],
  };
}

function normalizePlatform(raw: unknown): PlatformData {
  if (!isRecord(raw)) return emptyPlatform();
  const overrides: Record<string, Partial<Listing>> = {};
  if (isRecord(raw.listingOverrides)) {
    for (const [id, value] of Object.entries(raw.listingOverrides)) {
      if (isRecord(value)) overrides[id] = value as Partial<Listing>;
    }
  }
  const labels: Record<string, string> = {};
  if (isRecord(raw.categoryLabels)) {
    for (const [key, value] of Object.entries(raw.categoryLabels)) {
      if (typeof value === 'string' && value.trim()) labels[key] = value;
    }
  }
  const hidden = Array.isArray(raw.hiddenCategories)
    ? raw.hiddenCategories.filter((key): key is string => typeof key === 'string')
    : [];
  return {
    vouchers: Array.isArray(raw.vouchers)
      ? raw.vouchers.map(normalizeVoucher).filter((item): item is Voucher => Boolean(item))
      : [],
    banners: Array.isArray(raw.banners)
      ? raw.banners.map(normalizeBanner).filter((item): item is Banner => Boolean(item))
      : [],
    orders: Array.isArray(raw.orders)
      ? raw.orders.map(normalizeOrder).filter((item): item is Order => Boolean(item))
      : [],
    reviews: Array.isArray(raw.reviews)
      ? raw.reviews.map(normalizeReview).filter((item): item is ProductReview => Boolean(item))
      : [],
    listingOverrides: overrides,
    categoryLabels: labels,
    hiddenCategories: hidden,
  };
}

function normalizeAccount(raw: unknown): AccountData | null {
  if (!isRecord(raw)) return null;
  const profile = isRecord(raw.profile) ? raw.profile : {};
  return {
    role: raw.role === 'seller' ? 'seller' : 'buyer',
    seller: normalizeSeller(raw.seller),
    listings: Array.isArray(raw.listings)
      ? raw.listings.map(normalizeListing).filter((item): item is Listing => Boolean(item))
      : [],
    favorites: Array.isArray(raw.favorites)
      ? raw.favorites.filter((id): id is string => typeof id === 'string')
      : [],
    inquiries: Array.isArray(raw.inquiries) ? (raw.inquiries as Inquiry[]) : [],
    profile: {
      name: typeof profile.name === 'string' ? profile.name : 'Pengguna',
      email: typeof profile.email === 'string' ? profile.email : '',
      phone: typeof profile.phone === 'string' ? profile.phone : '',
      address: typeof profile.address === 'string' ? profile.address : '',
      coords: normalizeCoords(profile.coords),
    },
    ...normalizeShopping(raw),
  };
}

function loadState(): AppState {
  const fallback: AppState = {
    accounts: {},
    legacyListings: [],
    guest: emptyShopping(),
    platform: emptyPlatform(),
    activeUid: null,
    pendingRole: null,
    toast: null,
    cloudListings: null,
    cloudOrders: null,
    cloudInquiries: null,
    cloudPlatform: null,
    cloudReviews: null,
    cloudAdmin: false,
    cloudAdminReady: false,
  };
  if (typeof window === 'undefined') return fallback;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!isRecord(parsed)) return fallback;

  const accounts: Record<string, AccountData> = {};
  if (isRecord(parsed.accounts)) {
    for (const [uid, value] of Object.entries(parsed.accounts)) {
      const account = normalizeAccount(value);
      if (account) accounts[uid] = account;
    }
  }

  // Migrasi dari format lama: dulu semua data milik satu akun demo. Listing yang
  // dibuat pengguna tetap ditampilkan di katalog supaya tidak hilang.
  const legacyListings: Listing[] = Array.isArray(parsed.legacyListings)
    ? parsed.legacyListings
        .map(normalizeListing)
        .filter((item): item is Listing => Boolean(item))
    : Array.isArray(parsed.listings)
      ? parsed.listings
          .map(normalizeListing)
          .filter((item): item is Listing => Boolean(item))
          .filter((listing) => !SEED_IDS.has(listing.id))
      : [];

  return {
    accounts,
    legacyListings,
    guest: normalizeShopping(parsed.guest),
    platform: normalizePlatform(parsed.platform),
    activeUid: null,
    pendingRole: null,
    toast: null,
    cloudListings: null,
    cloudOrders: null,
    cloudInquiries: null,
    cloudPlatform: null,
    cloudReviews: null,
    cloudAdmin: false,
    cloudAdminReady: false,
  };
}

function sortNewestFirst(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function buildStores(listings: Listing[]): StoreInfo[] {
  const map = new Map<string, StoreInfo & { ratingTotal: number; ratedCount: number }>();
  for (const listing of listings) {
    const name = storeNameOf(listing);
    const key = `${listing.ownerId}::${name}`;
    const current =
      map.get(key) ??
      ({
        ownerId: listing.ownerId,
        name,
        city: listing.city,
        listingCount: 0,
        rating: 0,
        sold: 0,
        imageUrl: listing.imageUrl,
        ratingTotal: 0,
        ratedCount: 0,
      } as StoreInfo & { ratingTotal: number; ratedCount: number });
    current.listingCount += 1;
    current.sold += listing.sold ?? 0;
    if (listing.rating) {
      current.ratingTotal += listing.rating;
      current.ratedCount += 1;
    }
    if (!current.city && listing.city) current.city = listing.city;
    if (!current.imageUrl && listing.imageUrl) current.imageUrl = listing.imageUrl;
    map.set(key, current);
  }
  return Array.from(map.values())
    .map((store) => ({
      ownerId: store.ownerId,
      name: store.name,
      city: store.city,
      listingCount: store.listingCount,
      rating: store.ratedCount > 0 ? Math.round((store.ratingTotal / store.ratedCount) * 10) / 10 : 0,
      sold: store.sold,
      imageUrl: store.imageUrl,
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 12);
}

function dedupeVouchers(list: Voucher[]): Voucher[] {
  const map = new Map<string, Voucher>();
  for (const voucher of list) map.set(voucher.code.toUpperCase(), voucher);
  return Array.from(map.values());
}

/** Gabungkan pesanan lokal dengan snapshot Firestore; data cloud menang. */
function mergeOrders(...groups: (Order[] | null | undefined)[]): Order[] {
  const map = new Map<string, Order>();
  for (const group of groups) {
    for (const order of group ?? []) map.set(order.id, order);
  }
  return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Gabungkan pesan lokal dengan snapshot Firestore; data cloud menang. */
function mergeInquiries(...groups: (Inquiry[] | null | undefined)[]): Inquiry[] {
  const map = new Map<string, Inquiry>();
  for (const group of groups) {
    for (const inquiry of group ?? []) map.set(inquiry.id, inquiry);
  }
  return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Gabungkan ulasan lokal dengan snapshot Firestore; data cloud menang. */
function mergeReviews(...groups: (ProductReview[] | null | undefined)[]): ProductReview[] {
  const map = new Map<string, ProductReview>();
  for (const group of groups) {
    for (const review of group ?? []) map.set(review.id, review);
  }
  return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function applyOverride(listing: Listing, overrides: Record<string, Partial<Listing>>): Listing {
  const patch = overrides[listing.id];
  return patch ? { ...listing, ...patch } : listing;
}

/**
 * Susun tampilan dari state. Hasilnya di-cache karena `useSyncExternalStore`
 * memerlukan objek yang sama selama datanya tidak berubah.
 */
function buildView(state: AppState): AppView {
  const account = state.activeUid ? state.accounts[state.activeUid] : undefined;
  const owned = Object.values(state.accounts).flatMap((item) => item.listings);
  const inquiries = mergeInquiries(account?.inquiries ?? [], state.cloudInquiries);
  const unreadInquiriesCount = inquiries.filter((item) => !item.read).length;
  const shopping = account ?? state.guest;

  // Pengaturan cloud menang, tetapi override lokal (mis. rating dari ulasan baru)
  // tetap dipakai di peramban ini sampai ulasan ikut tersinkron.
  const platform: PlatformData = state.cloudPlatform
    ? {
        ...state.platform,
        ...state.cloudPlatform,
        listingOverrides: {
          ...(state.cloudPlatform.listingOverrides ?? {}),
          ...state.platform.listingOverrides,
        },
      }
    : state.platform;

  const userReviews = mergeReviews(platform.reviews, state.cloudReviews);
  const reviewStats = new Map<string, { sum: number; count: number }>();
  for (const review of userReviews) {
    const stat = reviewStats.get(review.listingId) ?? { sum: 0, count: 0 };
    stat.sum += review.rating;
    stat.count += 1;
    reviewStats.set(review.listingId, stat);
  }

  const sourceListings = state.cloudListings ?? [...owned, ...state.legacyListings];
  const listings = sortNewestFirst([...sourceListings, ...SEED_LISTINGS]).map((listing) => {
    const patched = applyOverride(listing, platform.listingOverrides);
    const stat = reviewStats.get(patched.id);
    if (!stat) return patched;

    // Gabungkan rating bawaan listing (data contoh) dengan ulasan pengguna.
    const baseCount = patched.reviewCount ?? 0;
    const baseRating = patched.rating ?? 0;
    const count = baseCount + stat.count;
    const rating = count > 0 ? Math.round(((baseRating * baseCount + stat.sum) / count) * 10) / 10 : patched.rating;
    return { ...patched, rating, reviewCount: count };
  });

  const vouchers = dedupeVouchers([...SEED_VOUCHERS, ...platform.vouchers]);
  const banners = [...SEED_BANNERS, ...platform.banners];
  const reviews = [...SEED_REVIEWS, ...userReviews].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const allOrders = mergeOrders(platform.orders, state.cloudOrders);
  const buyerOrders = allOrders.filter((order) =>
    state.activeUid ? order.buyerUid === state.activeUid : order.buyerUid === GUEST_UID,
  );

  const categories = LISTING_CATEGORIES.filter((name) => !platform.hiddenCategories.includes(name)).map(
    (name) => ({ name, label: platform.categoryLabels[name] ?? name }),
  );

  return {
    listings,
    favorites: account?.favorites ?? [],
    inquiries,
    unreadInquiriesCount,
    profile: account?.profile ?? GUEST_PROFILE,
    role: account?.role ?? null,
    seller: account?.seller ?? null,
    toast: state.toast,
    uid: state.activeUid,
    isSignedIn: Boolean(account),
    isAdmin: state.cloudAdmin,
    adminReady: state.cloudAdminReady,
    cart: shopping.cart,
    cartCount: shopping.cart.reduce((sum, item) => sum + item.qty, 0),
    addresses: shopping.addresses,
    claimedVoucherCodes: shopping.claimedVoucherCodes,
    orders: buyerOrders,
    platformOrders: allOrders,
    vouchers,
    banners,
    reviews,
    stores: buildStores(listings),
    categories,
  };
}

let state: AppState = loadState();
let view: AppView = buildView(state);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let toastCounter = 0;

let cloudAccountReady = false;
let cloudAccountRequest = 0;
let cloudAccountUnsubscribe: (() => void) | null = null;
let cloudAccountTimer: number | null = null;
let pendingGuest: ShoppingData | null = null;

function stopCloudAccount(): void {
  cloudAccountRequest += 1;
  cloudAccountUnsubscribe?.();
  cloudAccountUnsubscribe = null;
  if (cloudAccountTimer !== null) {
    window.clearTimeout(cloudAccountTimer);
    cloudAccountTimer = null;
  }
  cloudAccountReady = false;
  pendingGuest = null;
}

function mergeRemoteAccount(
  local: AccountData,
  remote: Partial<AccountData>,
  guest: ShoppingData | null,
): AccountData {
  const remoteAddresses = remote.addresses ?? [];
  const guestAddresses = guest?.addresses ?? [];
  const addresses = [
    ...remoteAddresses,
    ...guestAddresses.filter(
      (address) => !remoteAddresses.some((item) => item.id === address.id),
    ),
  ];

  return {
    ...local,
    ...remote,
    role: remote.role === 'seller' ? 'seller' : remote.role === 'buyer' ? 'buyer' : local.role,
    seller: remote.seller ?? local.seller,
    profile: { ...local.profile, ...(remote.profile ?? {}) },
    listings: local.listings,
    inquiries: local.inquiries,
    cart: mergeCarts(remote.cart ?? [], guest?.cart ?? []),
    addresses,
    claimedVoucherCodes: unique([
      ...(remote.claimedVoucherCodes ?? []),
      ...(guest?.claimedVoucherCodes ?? []),
    ]),
    favorites: remote.favorites ?? local.favorites,
  };
}

function startCloudAccount(uid: string, guest: ShoppingData): void {
  if (!firestoreEnabled) return;

  stopCloudAccount();
  const request = cloudAccountRequest;
  pendingGuest = guest;

  void subscribeAccount(
    uid,
    (remote, hasPendingWrites) => {
      if (request !== cloudAccountRequest || state.activeUid !== uid) return;

      cloudAccountReady = true;
      if (hasPendingWrites) return;

      const local = state.accounts[uid] ?? emptyAccount(null);
      const guestSnapshot = pendingGuest;
      const hasGuestData = Boolean(
        guestSnapshot &&
          (guestSnapshot.cart.length > 0 ||
            guestSnapshot.addresses.length > 0 ||
            guestSnapshot.claimedVoucherCodes.length > 0),
      );

      if (remote) {
        const merged = mergeRemoteAccount(local, remote, guestSnapshot);
        pendingGuest = null;
        commit(
          { ...state, accounts: { ...state.accounts, [uid]: merged } },
          { persist: false },
        );
        if (hasGuestData) scheduleCloudAccountSave();
        return;
      }

      pendingGuest = null;
      scheduleCloudAccountSave();
    },
    (error) => {
      if (request !== cloudAccountRequest) return;
      console.warn('[firestore] gagal memantau akun:', error);
    },
  )
    .then((unsubscribe) => {
      if (request !== cloudAccountRequest) {
        unsubscribe();
        return;
      }
      cloudAccountUnsubscribe = unsubscribe;
    })
    .catch((error) => {
      console.warn('[firestore] gagal memuat akun:', error);
    });
}

let cloudOrdersUnsubscribes: (() => void)[] = [];
let cloudOrdersRequest = 0;

function stopCloudOrders(): void {
  cloudOrdersRequest += 1;
  for (const unsubscribe of cloudOrdersUnsubscribes) unsubscribe();
  cloudOrdersUnsubscribes = [];
  setCloudAdmin(false, false);
}

/**
 * Pantau pesanan pembeli dan penjual. Admin juga memantau semua pesanan.
 * Snapshot digabung agar pembelian akun penjual tetap terlihat sebagai pembeli.
 */
function setCloudAdmin(admin: boolean, ready: boolean): void {
  if (state.cloudAdmin === admin && state.cloudAdminReady === ready) return;
  commit({ ...state, cloudAdmin: admin, cloudAdminReady: ready }, { persist: false });
}

function startCloudOrders(uid: string): void {
  if (!firestoreEnabled) {
    setCloudAdmin(false, true);
    return;
  }

  stopCloudOrders();
  const request = cloudOrdersRequest;
  const buckets: { buyer: Order[]; seller: Order[]; admin: Order[] } = {
    buyer: [],
    seller: [],
    admin: [],
  };

  const publish = () => {
    if (request !== cloudOrdersRequest || state.activeUid !== uid) return;
    commit(
      {
        ...state,
        cloudOrders: mergeOrders(buckets.buyer, buckets.seller, buckets.admin),
      },
      { persist: false },
    );
  };

  const track = (promise: Promise<() => void>, label: string) => {
    promise
      .then((unsubscribe) => {
        if (request !== cloudOrdersRequest) {
          unsubscribe();
          return;
        }
        cloudOrdersUnsubscribes.push(unsubscribe);
      })
      .catch((error) => {
        console.warn(`[firestore] gagal memantau ${label}:`, error);
      });
  };

  track(
    subscribeBuyerOrders(
      uid,
      (orders) => {
        buckets.buyer = orders;
        publish();
      },
      (error) => console.warn('[firestore] gagal memantau pesanan pembeli:', error),
    ),
    'pesanan pembeli',
  );

  track(
    subscribeSellerOrders(
      uid,
      (orders) => {
        buckets.seller = orders;
        publish();
      },
      (error) => console.warn('[firestore] gagal memantau pesanan penjual:', error),
    ),
    'pesanan penjual',
  );

  void isAdminUser(uid)
    .then((admin) => {
      if (request !== cloudOrdersRequest || state.activeUid !== uid) return;
      setCloudAdmin(admin, true);
      if (!admin) return;
      track(
        subscribeAllOrders(
          (orders) => {
            buckets.admin = orders;
            publish();
          },
          (error) => console.warn('[firestore] gagal memantau semua pesanan:', error),
        ),
        'semua pesanan admin',
      );
    })
    .catch((error) => {
      console.warn('[firestore] gagal memeriksa status admin:', error);
      if (request === cloudOrdersRequest && state.activeUid === uid) {
        setCloudAdmin(false, true);
      }
    });
}

let cloudInquiriesUnsubscribe: (() => void) | null = null;
let cloudInquiriesRequest = 0;

function stopCloudInquiries(): void {
  cloudInquiriesRequest += 1;
  cloudInquiriesUnsubscribe?.();
  cloudInquiriesUnsubscribe = null;
}

/** Pantau pesan masuk (toUid == uid) dan beri notifikasi untuk pesan baru. */
function startCloudInquiries(uid: string): void {
  if (!firestoreEnabled) return;

  stopCloudInquiries();
  const request = cloudInquiriesRequest;
  const seen = new Set<string>();
  let initialized = false;

  void subscribeInquiries(
    uid,
    (items) => {
      if (request !== cloudInquiriesRequest || state.activeUid !== uid) return;

      if (initialized) {
        for (const item of items) {
          if (!seen.has(item.id) && item.toUid === uid && !item.read) {
            notifyIncomingMessage(item);
          }
        }
      }
      for (const item of items) seen.add(item.id);
      initialized = true;

      commit({ ...state, cloudInquiries: items }, { persist: false });
    },
    (error) => {
      console.warn('[firestore] gagal memantau pesan:', error);
    },
  )
    .then((unsubscribe) => {
      if (request !== cloudInquiriesRequest) {
        unsubscribe();
        return;
      }
      cloudInquiriesUnsubscribe = unsubscribe;
    })
    .catch((error) => {
      console.warn('[firestore] gagal memuat pesan:', error);
    });
}

function scheduleCloudAccountSave(): void {
  if (!firestoreEnabled || !cloudAccountReady || !state.activeUid) return;

  const uid = state.activeUid;
  if (cloudAccountTimer !== null) window.clearTimeout(cloudAccountTimer);
  cloudAccountTimer = window.setTimeout(() => {
    cloudAccountTimer = null;
    if (!cloudAccountReady || state.activeUid !== uid) return;
    const account = state.accounts[uid];
    if (!account) return;
    void saveCloudAccount(uid, account).catch((error) => {
      console.warn('[firestore] gagal menyimpan akun:', error);
    });
  }, 500);
}

function persist(next: AppState): Toast | null {
  try {
    const payload: PersistedState = {
      accounts: next.accounts,
      legacyListings: next.legacyListings,
      guest: next.guest,
      platform: next.platform,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return null;
  } catch {
    return {
      id: ++toastCounter,
      message: 'Penyimpanan peramban penuh. Hapus beberapa listing atau foto lalu coba lagi.',
      tone: 'error',
    };
  }
}

function commit(next: AppState, options: { persist?: boolean } = {}): void {
  let final = next;
  if (options.persist !== false) {
    const quotaToast = persist(next);
    if (quotaToast) final = { ...next, toast: quotaToast };
  }
  state = final;
  view = buildView(state);
  emit();
  if (options.persist !== false) scheduleCloudAccountSave();
}

if (firestoreEnabled && typeof window !== 'undefined') {
  void subscribeListings(
    (listings) => {
      commit({ ...state, cloudListings: listings }, { persist: false });
    },
    (error) => {
      console.warn('[firestore] gagal memantau katalog, memakai data lokal:', error);
    },
  ).catch((error) => {
    console.warn('[firestore] gagal memuat katalog:', error);
  });

  void subscribePlatform(
    (platform) => {
      commit({ ...state, cloudPlatform: platform }, { persist: false });
    },
    (error) => {
      console.warn('[firestore] gagal memantau pengaturan platform:', error);
    },
  ).catch((error) => {
    console.warn('[firestore] gagal memuat pengaturan platform:', error);
  });

  void subscribeReviews(
    (reviews) => {
      commit({ ...state, cloudReviews: reviews }, { persist: false });
    },
    (error) => {
      console.warn('[firestore] gagal memantau ulasan:', error);
    },
  ).catch((error) => {
    console.warn('[firestore] gagal memuat ulasan:', error);
  });
}

/** Ambil bagian pengaturan yang dibagi ke cloud. */
function sharedPlatformOf(platform: PlatformData): SharedPlatform {
  return {
    vouchers: platform.vouchers,
    banners: platform.banners,
    listingOverrides: platform.listingOverrides,
    categoryLabels: platform.categoryLabels,
    hiddenCategories: platform.hiddenCategories,
  };
}

/** Simpan pengaturan promo/katalog ke Firestore (hanya admin yang diizinkan rules). */
function syncCloudPlatform(platform: PlatformData): void {
  if (!firestoreEnabled) return;
  void saveCloudPlatform(sharedPlatformOf(platform)).catch((error) => {
    console.warn('[firestore] gagal menyimpan pengaturan platform:', error);
  });
}

function toast(tone: Toast['tone'], message: string): Toast {
  return { id: ++toastCounter, message, tone };
}

function withAccount(
  patch: (account: AccountData) => AccountData,
): Partial<Pick<AppState, 'accounts'>> | null {
  if (!state.activeUid) return null;
  const current = state.accounts[state.activeUid] ?? emptyAccount(null);
  return { accounts: { ...state.accounts, [state.activeUid]: patch(current) } };
}

type ShoppingPatch = Partial<Pick<AppState, 'accounts' | 'guest'>>;

function currentShopping(): ShoppingData {
  const account = state.activeUid ? state.accounts[state.activeUid] : undefined;
  const source = account ?? state.guest;
  return {
    cart: source.cart,
    addresses: source.addresses,
    claimedVoucherCodes: source.claimedVoucherCodes,
  };
}

function withShopping(patch: (shopping: ShoppingData) => ShoppingData): ShoppingPatch {
  const next = patch(currentShopping());
  if (state.activeUid) {
    const current = state.accounts[state.activeUid] ?? emptyAccount(null);
    return { accounts: { ...state.accounts, [state.activeUid]: { ...current, ...next } } };
  }
  return { guest: { ...state.guest, ...next } };
}

function syncOrderStatus(orderId: string, status: OrderStatus): void {
  if (!firestoreEnabled || !state.activeUid) return;
  void updateCloudOrderStatus(orderId, status).catch((error) => {
    console.warn('[firestore] gagal memperbarui status pesanan:', error);
  });
}

if (typeof window !== 'undefined') {
  // Sinkronkan antar tab yang terbuka. Status masuk dibiarkan apa adanya.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const reloaded = loadState();

    if (state.activeUid) {
      const prevInquiries = state.accounts[state.activeUid]?.inquiries ?? [];
      const newInquiries = reloaded.accounts[state.activeUid]?.inquiries ?? [];
      if (newInquiries.length > prevInquiries.length) {
        const latest = newInquiries[0];
        if (latest && !latest.read) {
          notifyIncomingMessage(latest);
          commit(
            {
              ...reloaded,
              activeUid: state.activeUid,
              toast: toast('info', `Pesan masuk baru dari ${latest.name}`),
            },
            { persist: false },
          );
          return;
        }
      }
    }

    commit({ ...reloaded, activeUid: state.activeUid, toast: state.toast }, { persist: false });
  });
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export interface CheckoutInput {
  address: Address;
  shippingMethodId: string;
  paymentMethodId: string;
  voucherCode?: string;
  note?: string;
}

export interface CheckoutResult {
  ok: boolean;
  orderId?: string;
  error?: string;
}

export const store = {
  getSnapshot: (): AppView => view,
  subscribe,

  /** Dipanggil AuthProvider setiap status masuk berubah. */
  setActiveUser(user: AuthUser | null): void {
    if (!user) {
      stopCloudAccount();
      stopCloudOrders();
      stopCloudInquiries();
      if (
        !state.activeUid &&
        !state.pendingRole &&
        !state.cloudOrders &&
        !state.cloudInquiries &&
        !state.cloudAdmin &&
        !state.cloudAdminReady
      ) {
        return;
      }
      commit(
        {
          ...state,
          activeUid: null,
          pendingRole: null,
          cloudOrders: null,
          cloudInquiries: null,
          cloudAdmin: false,
          cloudAdminReady: false,
        },
        { persist: false },
      );
      return;
    }

    if (state.activeUid === user.uid) return;

    const existingAccount = state.accounts[user.uid];
    const existing = existingAccount ?? emptyAccount(user, state.pendingRole ?? 'buyer');
    const profile: Profile = {
      ...existing.profile,
      name: existing.profile.name || user.displayName || 'Pengguna',
      email: existing.profile.email || user.email,
      phone: existing.profile.phone,
    };

    // Keranjang, alamat, dan voucher tamu dipindahkan ke akun saat masuk.
    const guest = state.guest;
    const merged: AccountData = {
      ...existing,
      profile,
      cart: mergeCarts(existing.cart, guest.cart),
      addresses: [
        ...existing.addresses,
        ...guest.addresses.filter((address) => !existing.addresses.some((item) => item.id === address.id)),
      ],
      claimedVoucherCodes: unique([...existing.claimedVoucherCodes, ...guest.claimedVoucherCodes]),
    };

    // Pesanan tamu ikut menjadi milik akun yang baru masuk.
    const orders = state.platform.orders.map((order) =>
      order.buyerUid === GUEST_UID ? { ...order, buyerUid: user.uid, buyerName: profile.name } : order,
    );

    commit(
      {
        ...state,
        activeUid: user.uid,
        pendingRole: null,
        accounts: { ...state.accounts, [user.uid]: merged },
        guest: emptyShopping(),
        platform: { ...state.platform, orders },
        cloudOrders: null,
        cloudInquiries: null,
        cloudAdmin: false,
        cloudAdminReady: false,
      },
      { persist: true },
    );

    startCloudAccount(user.uid, guest);
    startCloudOrders(user.uid);
    startCloudInquiries(user.uid);

    if (firestoreEnabled) {
      void migrateOrders(user.uid, orders)
        .then((count) => {
          if (count > 0) console.info(`[firestore] ${count} pesanan lokal diunggah.`);
        })
        .catch((error) => {
          console.warn('[firestore] gagal mengunggah pesanan lokal:', error);
        });

      void migrateListings(user.uid, merged.listings)
        .then((count) => {
          if (count > 0) console.info(`[firestore] ${count} listing lokal diunggah.`);
        })
        .catch((error) => {
          console.warn('[firestore] gagal mengunggah listing lokal:', error);
        });
    }
  },

  /** Peran yang akan dipakai bila akun baru dibuat saat pendaftaran. */
  setPendingRole(role: UserRole | null): void {
    if (state.pendingRole === role) return;
    state = { ...state, pendingRole: role };
  },

  /** Peran akun tertentu dari data tersimpan, null bila belum dikenal. */
  getRoleFor(uid: string): UserRole | null {
    return state.accounts[uid]?.role ?? null;
  },

  /**
   * Simpan kriteria penjual. Dipakai saat daftar penjual maupun saat pembeli
   * meng-upgrade akunnya menjadi penjual.
   */
  saveSellerRegistration(seller: SellerProfile): void {
    const patch = withAccount((account) => {
      const profile: Profile = { ...account.profile };
      if (!profile.coords && seller.coords) {
        profile.coords = seller.coords;
        if (!profile.address) profile.address = seller.address;
      }
      return { ...account, role: 'seller', seller, profile };
    });
    if (!patch) {
      commit({ ...state, toast: toast('error', 'Masuk dulu untuk mendaftar sebagai penjual.') }, { persist: false });
      return;
    }
    commit({
      ...state,
      ...patch,
      toast: toast('success', 'Akun penjual aktif. Selamat berjualan!'),
    });
  },

  upsertListing(listing: Listing): void {
    const current = state.activeUid ? state.accounts[state.activeUid] : undefined;
    if (!current) {
      commit({ ...state, toast: toast('error', 'Masuk dulu untuk memasang listing.') }, { persist: false });
      return;
    }
    if (current.role !== 'seller') {
      commit(
        { ...state, toast: toast('error', 'Hanya akun penjual yang bisa memasang listing.') },
        { persist: false },
      );
      return;
    }
    const patch = withAccount((account) => {
      const exists = account.listings.some((item) => item.id === listing.id);
      return {
        ...account,
        listings: exists
          ? account.listings.map((item) => (item.id === listing.id ? listing : item))
          : [listing, ...account.listings],
      };
    });
    if (!patch) return;
    const exists = view.listings.some((item) => item.id === listing.id);
    const cloudListings = state.cloudListings
      ? [...state.cloudListings.filter((item) => item.id !== listing.id), listing]
      : state.cloudListings;
    commit({
      ...state,
      ...patch,
      cloudListings,
      toast: toast('success', exists ? 'Listing diperbarui.' : 'Listing berhasil dipasang.'),
    });
    void saveCloudListing(listing).catch((error) => {
      console.warn('[firestore] gagal menyimpan listing:', error);
      commit(
        {
          ...state,
          toast: toast('error', 'Listing tersimpan lokal, tetapi gagal dikirim ke server.'),
        },
        { persist: false },
      );
    });
  },

  removeListing(id: string): void {
    const patch = withAccount((account) => ({
      ...account,
      listings: account.listings.filter((item) => item.id !== id),
      favorites: account.favorites.filter((fav) => fav !== id),
    }));
    if (!patch) return;
    commit({
      ...state,
      ...patch,
      cloudListings: state.cloudListings
        ? state.cloudListings.filter((item) => item.id !== id)
        : state.cloudListings,
      toast: toast('success', 'Listing dihapus.'),
    });
    void deleteCloudListing(id).catch((error) => {
      console.warn('[firestore] gagal menghapus listing:', error);
      commit(
        {
          ...state,
          toast: toast('error', 'Listing terhapus lokal, tetapi gagal dihapus dari server.'),
        },
        { persist: false },
      );
    });
  },

  toggleFavorite(id: string): void {
    const patch = withAccount((account) => ({
      ...account,
      favorites: account.favorites.includes(id)
        ? account.favorites.filter((fav) => fav !== id)
        : [...account.favorites, id],
    }));
    if (!patch) {
      commit({ ...state, toast: toast('info', 'Masuk dulu untuk menyimpan favorit.') }, { persist: false });
      return;
    }
    const wasFavorite = view.favorites.includes(id);
    commit({
      ...state,
      ...patch,
      toast: toast('info', wasFavorite ? 'Dihapus dari favorit.' : 'Ditambahkan ke favorit.'),
    });
  },

  updateProfile(profile: Profile): void {
    const patch = withAccount((account) => ({ ...account, profile }));
    if (!patch) return;
    commit({ ...state, ...patch, toast: toast('success', 'Profil disimpan.') });
  },

  /** Simpan alamat/koordinat pembeli tanpa toast (dipakai saat pendaftaran). */
  saveBuyerAddress(address: string, coords: GeoCoords | null): void {
    const patch = withAccount((account) => ({
      ...account,
      profile: { ...account.profile, address: address.trim(), coords: coords ?? null },
    }));
    if (!patch) return;
    commit({ ...state, ...patch }, { persist: true });
  },

  addInquiry(inquiry: Inquiry, targetOwnerId?: string, syncCloud = true): void {
    const item: Inquiry = {
      ...inquiry,
      read: false,
      fromUid: inquiry.fromUid ?? state.activeUid ?? undefined,
      toUid: inquiry.toUid ?? targetOwnerId ?? state.activeUid ?? undefined,
    };

    const upload = () => {
      if (!syncCloud || !firestoreEnabled || !item.fromUid || !item.toUid) return;
      void saveCloudInquiry(item).catch((error) => {
        console.warn('[firestore] gagal menyimpan pesan:', error);
      });
    };

    // Jika pemilik properti adalah akun terdaftar yang berbeda
    if (targetOwnerId && targetOwnerId !== state.activeUid && state.accounts[targetOwnerId]) {
      const targetAcc = state.accounts[targetOwnerId];
      const updatedAccounts = {
        ...state.accounts,
        [targetOwnerId]: {
          ...targetAcc,
          inquiries: [item, ...targetAcc.inquiries],
        },
      };

      commit({
        ...state,
        accounts: updatedAccounts,
        toast: toast('success', 'Pesan terkirim ke penjual.'),
      });
      upload();
      return;
    }

    // Default (atau jika dikirim ke diri sendiri / properti demo):
    const patch = withAccount((account) => ({
      ...account,
      inquiries: [item, ...account.inquiries],
    }));

    if (!patch) {
      commit({ ...state, toast: toast('error', 'Masuk dulu untuk mengirim pesan.') }, { persist: false });
      return;
    }

    commit({
      ...state,
      ...patch,
      toast: toast('info', `Pesan masuk baru dari ${item.name}`),
    });

    notifyIncomingMessage(item);
    upload();
  },

  markInquiryAsRead(id: string): void {
    const uid = state.activeUid;
    const cloudItem = view.inquiries.find((item) => item.id === id);
    const patch = withAccount((account) => ({
      ...account,
      inquiries: account.inquiries.map((item) =>
        item.id === id ? { ...item, read: true } : item
      ),
    }));
    if (!patch) return;
    commit({ ...state, ...patch }, { persist: true });
    if (firestoreEnabled && uid && cloudItem?.toUid === uid) {
      void updateCloudInquiryRead(id, true).catch((error) => {
        console.warn('[firestore] gagal menandai pesan dibaca:', error);
      });
    }
  },

  markAllInquiriesAsRead(): void {
    const uid = state.activeUid;
    const unreadCloudIds = view.inquiries
      .filter((item) => item.toUid === uid && !item.read)
      .map((item) => item.id);
    const patch = withAccount((account) => ({
      ...account,
      inquiries: account.inquiries.map((item) => ({ ...item, read: true })),
    }));
    if (!patch) return;
    commit({ ...state, ...patch }, { persist: true });
    if (firestoreEnabled && uid) {
      for (const id of unreadCloudIds) {
        void updateCloudInquiryRead(id, true).catch((error) => {
          console.warn('[firestore] gagal menandai pesan dibaca:', error);
        });
      }
    }
  },

  simulateIncomingInquiry(): void {
    const sampleNames = ['Budi Pratama', 'Siti Rahmawati', 'Dimas Anggara', 'Anisa Putri'];
    const sampleTitles = [
      'Villa Modern Minimalis di Canggu',
      'Rumah Mewah Pondok Indah',
      'Apartemen Sudirman Tower',
      'Tanah Kavling Siap Bangun',
    ];
    const sampleMessages = [
      'Halo, apakah properti ini masih tersedia untuk survei besok?',
      'Selamat siang, apakah harga masih bisa dinegosiasikan?',
      'Saya tertarik dengan unit ini. Boleh minta detail sertifikatnya?',
      'Bisa dijadwalkan survei lokasi akhir pekan ini?',
    ];
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const simulated: Inquiry = {
      id: newId('inquiry'),
      listingId: newId('demo'),
      listingTitle: pick(sampleTitles),
      name: pick(sampleNames),
      phone: `0812${Math.floor(10000000 + Math.random() * 90000000)}`,
      message: pick(sampleMessages),
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.addInquiry(simulated, undefined, false);
  },

  removeInquiry(id: string): void {
    const uid = state.activeUid;
    const cloudItem = view.inquiries.find((item) => item.id === id);
    const patch = withAccount((account) => ({
      ...account,
      inquiries: account.inquiries.filter((item) => item.id !== id),
    }));
    if (!patch) return;
    commit({ ...state, ...patch });
    if (firestoreEnabled && uid && cloudItem && (cloudItem.fromUid === uid || cloudItem.toUid === uid)) {
      void deleteCloudInquiry(id).catch((error) => {
        console.warn('[firestore] gagal menghapus pesan:', error);
      });
    }
  },

  /* ----------------------------- Keranjang ----------------------------- */

  addToCart(listingId: string, qty = 1, variation?: string): string | null {
    const listing = view.listings.find((item) => item.id === listingId);
    if (!listing) {
      commit({ ...state, toast: toast('error', 'Produk tidak ditemukan.') }, { persist: false });
      return null;
    }
    const stock = stockOf(listing);
    if (stock <= 0) {
      commit({ ...state, toast: toast('error', 'Stok produk ini habis.') }, { persist: false });
      return null;
    }

    const lineId = `${listingId}${variation ? `::${variation}` : ''}`;
    const amount = Math.max(1, Math.floor(qty));
    const patch = withShopping((shopping) => {
      const existing = shopping.cart.find((item) => item.id === lineId);
      if (existing) {
        return {
          ...shopping,
          cart: shopping.cart.map((item) =>
            item.id === lineId ? { ...item, qty: Math.min(stock, item.qty + amount), selected: true } : item,
          ),
        };
      }
      const line: CartItem = {
        id: lineId,
        listingId,
        qty: Math.min(stock, amount),
        variation,
        selected: true,
        addedAt: new Date().toISOString(),
      };
      return { ...shopping, cart: [...shopping.cart, line] };
    });

    commit({
      ...state,
      ...patch,
      toast: toast('success', `${listing.title} ditambahkan ke keranjang.`),
    });
    return lineId;
  },

  updateCartQty(lineId: string, qty: number): void {
    const nextQty = Math.max(1, Math.floor(qty));
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.map((item) => {
        if (item.id !== lineId) return item;
        const listing = view.listings.find((entry) => entry.id === item.listingId);
        const stock = listing ? stockOf(listing) : 99;
        return { ...item, qty: Math.min(Math.max(1, stock), nextQty) };
      }),
    }));
    commit({ ...state, ...patch }, { persist: true });
  },

  toggleCartItem(lineId: string): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.map((item) => (item.id === lineId ? { ...item, selected: !item.selected } : item)),
    }));
    commit({ ...state, ...patch }, { persist: true });
  },

  toggleAllCart(selected: boolean): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.map((item) => ({ ...item, selected })),
    }));
    commit({ ...state, ...patch }, { persist: true });
  },

  removeCartItem(lineId: string): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.filter((item) => item.id !== lineId),
    }));
    commit({ ...state, ...patch, toast: toast('info', 'Produk dihapus dari keranjang.') });
  },

  removeSelectedCartItems(): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.filter((item) => !item.selected),
    }));
    commit({ ...state, ...patch, toast: toast('success', 'Produk terpilih dihapus.') });
  },

  selectOnlyCartLine(lineId: string): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.map((item) => ({ ...item, selected: item.id === lineId })),
    }));
    commit({ ...state, ...patch }, { persist: true });
  },

  /* ------------------------------ Alamat ------------------------------- */

  saveAddress(address: Address): void {
    const patch = withShopping((shopping) => {
      const exists = shopping.addresses.some((item) => item.id === address.id);
      let addresses = exists
        ? shopping.addresses.map((item) => (item.id === address.id ? address : item))
        : [...shopping.addresses, address];
      if (address.isDefault || addresses.length === 1) {
        addresses = addresses.map((item) => ({ ...item, isDefault: item.id === address.id }));
      }
      return { ...shopping, addresses };
    });
    commit({ ...state, ...patch, toast: toast('success', 'Alamat disimpan.') });
  },

  removeAddress(id: string): void {
    const patch = withShopping((shopping) => {
      const addresses = shopping.addresses.filter((item) => item.id !== id);
      if (addresses.length > 0 && !addresses.some((item) => item.isDefault)) {
        addresses[0] = { ...addresses[0], isDefault: true };
      }
      return { ...shopping, addresses };
    });
    commit({ ...state, ...patch, toast: toast('info', 'Alamat dihapus.') });
  },

  setDefaultAddress(id: string): void {
    const patch = withShopping((shopping) => ({
      ...shopping,
      addresses: shopping.addresses.map((item) => ({ ...item, isDefault: item.id === id })),
    }));
    commit({ ...state, ...patch, toast: toast('success', 'Alamat utama diperbarui.') });
  },

  /* ------------------------------ Voucher ------------------------------ */

  claimVoucher(code: string): void {
    const voucher = view.vouchers.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!voucher) {
      commit({ ...state, toast: toast('error', 'Kode voucher tidak ditemukan.') }, { persist: false });
      return;
    }
    if (view.claimedVoucherCodes.includes(voucher.code)) {
      commit({ ...state, toast: toast('info', 'Voucher sudah ada di koleksi Anda.') }, { persist: false });
      return;
    }
    const patch = withShopping((shopping) => ({
      ...shopping,
      claimedVoucherCodes: [...shopping.claimedVoucherCodes, voucher.code],
    }));
    commit({ ...state, ...patch, toast: toast('success', `Voucher ${voucher.code} berhasil diklaim.`) });
  },

  /* ------------------------------ Checkout ----------------------------- */

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const lines = hydrateCart(view.cart, view.listings).filter((line) => line.selected && line.qty > 0);
    if (lines.length === 0) return { ok: false, error: 'Pilih minimal satu produk di keranjang.' };

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const voucher = input.voucherCode
      ? view.vouchers.find((item) => item.code.toUpperCase() === input.voucherCode!.toUpperCase())
      : undefined;
    if (input.voucherCode && (!voucher || !voucherEligible(voucher, subtotal))) {
      return { ok: false, error: 'Voucher tidak berlaku untuk transaksi ini.' };
    }
    if (voucher && !view.claimedVoucherCodes.includes(voucher.code)) {
      return { ok: false, error: 'Klaim voucher di pusat voucher sebelum memakainya.' };
    }

    // Di mode Firestore, server menghitung ulang harga, voucher, dan stok lalu
    // menulis pesanan dengan Admin SDK. Rules melarang create langsung dari client.
    if (firestoreEnabled && state.activeUid) {
      let result: Awaited<ReturnType<typeof createOrderOnServer>>;
      try {
        result = await createOrderOnServer({
          items: lines.map((line) => ({
            listingId: line.listingId,
            qty: line.qty,
            variation: line.variation,
          })),
          address: input.address,
          shippingMethodId: input.shippingMethodId,
          paymentMethodId: input.paymentMethodId,
          voucherCode: voucher?.code,
          note: input.note?.trim() || undefined,
        });
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Checkout gagal. Coba lagi.',
        };
      }
      if (!result.ok) return { ok: false, error: result.error };

      const order = result.order;
      const shoppingPatch = withShopping((shopping) => ({
        ...shopping,
        cart: shopping.cart.filter((item) => !lines.some((line) => line.id === item.id)),
        claimedVoucherCodes: voucher
          ? unique([...shopping.claimedVoucherCodes, voucher.code])
          : shopping.claimedVoucherCodes,
      }));
      commit({
        ...state,
        ...shoppingPatch,
        platform: { ...state.platform, orders: [order, ...state.platform.orders] },
        toast: toast('success', `Pesanan ${order.code} berhasil dibuat.`),
      });
      return { ok: true, orderId: order.id };
    }

    const totals = calculateTotals(subtotal, input.shippingMethodId, voucher);
    const shippingMethod =
      input.shippingMethodId === 'yes'
        ? 'Next Day'
        : input.shippingMethodId === 'instant'
          ? 'Instan'
          : input.shippingMethodId === 'cargo'
            ? 'Kargo'
            : 'Reguler';
    const paymentMethod =
      input.paymentMethodId === 'transfer-mandiri'
        ? 'Transfer Bank Mandiri'
        : input.paymentMethodId === 'ewallet'
          ? 'E-Wallet'
          : input.paymentMethodId === 'qris'
            ? 'QRIS'
            : input.paymentMethodId === 'cod'
              ? 'COD / Bayar di Tempat'
              : 'Transfer Bank BCA';

    const now = new Date();
    const order: Order = {
      id: newId('order'),
      code: `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      items: lines.map((line) => ({
        listingId: line.listingId,
        title: line.listing.title,
        imageUrl: line.listing.imageUrl || line.listing.images?.[0] || '',
        price: line.unitPrice,
        qty: line.qty,
        variation: line.variation,
        isFlash: isFlashAvailable(line.listing),
        ownerId: line.listing.ownerId,
        ownerName: storeNameOf(line.listing),
        category: line.listing.category,
      })),
      listingIds: unique(lines.map((line) => line.listingId)),
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      cashback: totals.cashback,
      voucherCode: voucher?.code,
      total: totals.total,
      status: 'belum-dibayar',
      recipient: input.address.recipient,
      phone: input.address.phone,
      address: input.address.detail,
      city: input.address.city,
      shippingMethod,
      shippingMethodId: input.shippingMethodId,
      paymentMethod,
      paymentMethodId: input.paymentMethodId,
      note: input.note?.trim() || undefined,
      buyerUid: state.activeUid ?? GUEST_UID,
      buyerName: state.activeUid ? (view.profile.name || 'Pembeli') : (input.address.recipient || 'Tamu'),
      createdAt: now.toISOString(),
    };

    // Kurangi stok & tambah jumlah terjual (agregat per listing, termasuk varian).
    const overrides = { ...state.platform.listingOverrides };
    const qtyByListing = new Map<string, number>();
    for (const line of lines) {
      qtyByListing.set(line.listingId, (qtyByListing.get(line.listingId) ?? 0) + line.qty);
    }
    for (const [listingId, qty] of qtyByListing) {
      const listing = view.listings.find((item) => item.id === listingId);
      if (!listing) continue;
      const baseStock = listing.stock ?? 99;
      const flash = isFlashAvailable(listing);
      const patch: Partial<Listing> = {
        ...(overrides[listing.id] ?? {}),
        stock: Math.max(0, baseStock - qty),
        sold: (listing.sold ?? 0) + qty,
      };
      if (flash && typeof listing.flashStock === 'number') {
        patch.flashStock = Math.max(0, listing.flashStock - qty);
      }
      overrides[listing.id] = patch;
    }

    const shoppingPatch = withShopping((shopping) => ({
      ...shopping,
      cart: shopping.cart.filter((item) => !lines.some((line) => line.id === item.id)),
      claimedVoucherCodes: voucher
        ? unique([...shopping.claimedVoucherCodes, voucher.code])
        : shopping.claimedVoucherCodes,
    }));

    commit({
      ...state,
      ...shoppingPatch,
      platform: {
        ...state.platform,
        orders: [order, ...state.platform.orders],
        listingOverrides: overrides,
      },
      toast: toast('success', `Pesanan ${order.code} berhasil dibuat.`),
    });

    return { ok: true, orderId: order.id };
  },

  payOrder(orderId: string): void {
    const target = state.platform.orders.find((order) => order.id === orderId);
    const isCod = target?.paymentMethodId === 'cod';
    const orders = state.platform.orders.map((order) =>
      order.id === orderId
        ? { ...order, status: 'dikemas' as OrderStatus, paidAt: new Date().toISOString() }
        : order,
    );
    commit({
      ...state,
      platform: { ...state.platform, orders },
      toast: toast(
        'success',
        isCod
          ? 'Pesanan COD dikonfirmasi. Bayar saat paket diterima.'
          : 'Pembayaran berhasil. Pesanan sedang dikemas.',
      ),
    });
    syncOrderStatus(orderId, 'dikemas');
  },

  cancelOrder(orderId: string): void {
    const target = state.platform.orders.find((order) => order.id === orderId);
    if (!target) return;
    const overrides = { ...state.platform.listingOverrides };
    if (target.status !== 'dibatalkan') {
      const qtyByListing = new Map<string, number>();
      const flashQtyByListing = new Map<string, number>();
      for (const item of target.items) {
        qtyByListing.set(item.listingId, (qtyByListing.get(item.listingId) ?? 0) + item.qty);
        if (item.isFlash) {
          flashQtyByListing.set(item.listingId, (flashQtyByListing.get(item.listingId) ?? 0) + item.qty);
        }
      }
      for (const [listingId, qty] of qtyByListing) {
        const listing = view.listings.find((entry) => entry.id === listingId);
        if (!listing) continue;
        const baseStock = listing.stock ?? 99;
        const patch: Partial<Listing> = {
          ...(overrides[listingId] ?? {}),
          stock: baseStock + qty,
          sold: Math.max(0, (listing.sold ?? 0) - qty),
        };
        const flashQty = flashQtyByListing.get(listingId) ?? 0;
        if (flashQty > 0 && typeof listing.flashStock === 'number') {
          patch.flashStock = listing.flashStock + flashQty;
        }
        overrides[listingId] = patch;
      }
    }
    const orders = state.platform.orders.map((order) =>
      order.id === orderId ? { ...order, status: 'dibatalkan' as OrderStatus } : order,
    );
    commit({
      ...state,
      platform: { ...state.platform, orders, listingOverrides: overrides },
      toast: toast('info', 'Pesanan dibatalkan.'),
    });
    syncOrderStatus(orderId, 'dibatalkan');
  },

  confirmOrderReceived(orderId: string): void {
    const orders = state.platform.orders.map((order) =>
      order.id === orderId
        ? { ...order, status: 'selesai' as OrderStatus, completedAt: new Date().toISOString() }
        : order,
    );
    commit({
      ...state,
      platform: { ...state.platform, orders },
      toast: toast('success', 'Terima kasih! Pesanan ditandai selesai.'),
    });
    syncOrderStatus(orderId, 'selesai');
  },

  updateOrderStatus(orderId: string, status: OrderStatus): void {
    const orders = state.platform.orders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status,
            paidAt: status !== 'belum-dibayar' && !order.paidAt ? new Date().toISOString() : order.paidAt,
            completedAt: status === 'selesai' ? new Date().toISOString() : order.completedAt,
          }
        : order,
    );
    commit({
      ...state,
      platform: { ...state.platform, orders },
      toast: toast('success', 'Status pesanan diperbarui.'),
    });
    syncOrderStatus(orderId, status);
  },

  async addReview(
    orderId: string,
    listingId: string,
    rating: number,
    comment: string,
  ): Promise<boolean> {
    const listing = view.listings.find((item) => item.id === listingId);
    const order = view.orders.find((item) => item.id === orderId);
    if (!listing || !order) {
      commit({ ...state, toast: toast('error', 'Ulasan hanya bisa dibuat dari pesanan yang valid.') });
      return false;
    }

    const buyerUid = state.activeUid ?? GUEST_UID;
    if (
      order.buyerUid !== buyerUid ||
      order.status !== 'selesai' ||
      !order.items.some((item) => item.listingId === listingId)
    ) {
      commit({
        ...state,
        toast: toast('error', 'Ulasan hanya bisa dibuat setelah pesanan berstatus selesai.'),
      });
      return false;
    }
    if (state.activeUid && listing.ownerId === state.activeUid) {
      commit({ ...state, toast: toast('error', 'Anda tidak dapat mengulas produk milik sendiri.') });
      return false;
    }

    const id = `review-${orderId}-${listingId}`;
    const existing = view.reviews.find((item) => item.id === id);
    const review: ProductReview = {
      id,
      listingId,
      orderId,
      name: view.profile.name || 'Pembeli',
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: comment.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      authorUid: state.activeUid ?? undefined,
    };

    if (firestoreEnabled && review.authorUid) {
      try {
        await saveCloudReview(review);
      } catch (error) {
        console.warn('[firestore] gagal menyimpan ulasan:', error);
        commit({
          ...state,
          toast: toast(
            'error',
            'Ulasan gagal disimpan. Pastikan pesanan sudah berstatus selesai, lalu coba lagi.',
          ),
        });
        return false;
      }
    }

    commit({
      ...state,
      platform: {
        ...state.platform,
        reviews: [review, ...state.platform.reviews.filter((item) => item.id !== id)],
      },
      toast: toast('success', 'Ulasan Anda tersimpan. Terima kasih!'),
    });
    return true;
  },

  /* --------------------------- Admin / promo --------------------------- */

  adminUpdateListing(id: string, patch: Partial<Listing>): void {
    const overrides = {
      ...state.platform.listingOverrides,
      [id]: { ...(state.platform.listingOverrides[id] ?? {}), ...patch },
    };
    const platform = { ...state.platform, listingOverrides: overrides };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('success', 'Data produk diperbarui.'),
    });
  },

  adminResetOverrides(): void {
    const platform = { ...state.platform, listingOverrides: {} };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('info', 'Perubahan produk dikembalikan ke data awal.'),
    });
  },

  adminAddVoucher(voucher: Voucher): void {
    const platform = {
      ...state.platform,
      vouchers: [...state.platform.vouchers.filter((item) => item.code !== voucher.code), voucher],
    };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('success', `Voucher ${voucher.code} ditambahkan.`),
    });
  },

  adminRemoveVoucher(id: string): void {
    const platform = {
      ...state.platform,
      vouchers: state.platform.vouchers.filter((item) => item.id !== id),
    };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('info', 'Voucher dihapus.'),
    });
  },

  adminAddBanner(banner: Banner): void {
    const platform = { ...state.platform, banners: [banner, ...state.platform.banners] };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('success', 'Banner promosi ditambahkan.'),
    });
  },

  adminRemoveBanner(id: string): void {
    const platform = {
      ...state.platform,
      banners: state.platform.banners.filter((item) => item.id !== id),
    };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('info', 'Banner dihapus.'),
    });
  },

  adminSetCategoryLabel(category: string, label: string): void {
    const labels = { ...state.platform.categoryLabels };
    if (label.trim()) labels[category] = label.trim();
    else delete labels[category];
    const platform = { ...state.platform, categoryLabels: labels };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('success', 'Nama kategori diperbarui.'),
    });
  },

  adminToggleCategory(category: string): void {
    const hidden = state.platform.hiddenCategories.includes(category)
      ? state.platform.hiddenCategories.filter((item) => item !== category)
      : [...state.platform.hiddenCategories, category];
    const platform = { ...state.platform, hiddenCategories: hidden };
    syncCloudPlatform(platform);
    commit({
      ...state,
      platform,
      toast: toast('info', hidden.includes(category) ? 'Kategori disembunyikan.' : 'Kategori ditampilkan.'),
    });
  },

  showToast(message: string, tone: Toast['tone'] = 'info'): void {
    commit({ ...state, toast: toast(tone, message) }, { persist: false });
  },

  dismissToast(): void {
    if (!state.toast) return;
    commit({ ...state, toast: null }, { persist: false });
  },

  /** Kosongkan listing, favorit, pesan, keranjang, alamat, dan voucher milik akun. */
  resetAccountData(): void {
    if (!state.activeUid) return;
    const uid = state.activeUid;
    const previous = state.accounts[uid] ?? emptyAccount(null);
    const listingIds = new Set([
      ...previous.listings.map((listing) => listing.id),
      ...(state.cloudListings ?? []).filter((listing) => listing.ownerId === uid).map((listing) => listing.id),
    ]);
    const inquiryIds = new Set([
      ...previous.inquiries.map((inquiry) => inquiry.id),
      ...(state.cloudInquiries ?? []).map((inquiry) => inquiry.id),
    ]);
    commit({
      ...state,
      accounts: {
        ...state.accounts,
        [uid]: {
          role: previous.role,
          seller: previous.seller,
          listings: [],
          favorites: [],
          inquiries: [],
          profile: { ...previous.profile, phone: '' },
          ...emptyShopping(),
        },
      },
      toast: toast('success', 'Data akun dikosongkan.'),
    });
    if (firestoreEnabled) {
      for (const id of listingIds) {
        void deleteCloudListing(id).catch((error) => {
          console.warn('[firestore] gagal menghapus listing saat mengosongkan akun:', error);
        });
      }
      for (const id of inquiryIds) {
        void deleteCloudInquiry(id).catch((error) => {
          console.warn('[firestore] gagal menghapus pesan saat mengosongkan akun:', error);
        });
      }
    }
  },
};

export function useAppState(): AppView {
  return useSyncExternalStore(subscribe, store.getSnapshot, store.getSnapshot);
}

/** Listing milik akun yang sedang masuk saja. */
export function useMyListings(): Listing[] {
  const snapshot = useAppState();
  if (!snapshot.uid) return [];
  return snapshot.listings.filter((listing) => listing.ownerId === snapshot.uid);
}

export function useFavorites(): Listing[] {
  const { listings, favorites } = useAppState();
  return favorites
    .map((id) => listings.find((listing) => listing.id === id))
    .filter((listing): listing is Listing => Boolean(listing));
}
