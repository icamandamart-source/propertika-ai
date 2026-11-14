/** Peran akun. Pembeli dan penjual memakai alur masuk yang terpisah. */
export const USER_ROLES = ['buyer', 'seller'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SELLER_TYPES = [
  'Agen Properti',
  'Pengembang / Developer',
  'Perorangan',
  'Supplier Material',
  'Perusahaan Properti',
] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

/** Titik koordinat bumi (derajat). Dipakai untuk menghitung jarak antar lokasi. */
export interface GeoCoords {
  lat: number;
  lng: number;
}

/** Data tambahan yang wajib dilengkapi penjual saat mendaftar atau upgrade. */
export interface SellerProfile {
  businessName: string;
  sellerType: SellerType | '';
  phone: string;
  city: string;
  address: string;
  npwp: string;
  description: string;
  /** Koordinat lokasi usaha/toko, terisi setelah memakai deteksi lokasi. */
  coords?: GeoCoords | null;
}

export const LISTING_CATEGORIES = ['Rumah', 'Apartemen', 'Tanah', 'Furniture'] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

/** Varian produk sederhana, mis. Warna: Natural / Abu / Hitam. */
export interface ListingVariation {
  name: string;
  options: string[];
}

export const LISTING_PURPOSES = ['Dijual', 'Disewa'] as const;
export type ListingPurpose = (typeof LISTING_PURPOSES)[number];

/** Jumlah maksimum foto galeri tambahan per listing (di luar foto utama). */
export const MAX_GALLERY_IMAGES = 4;

export interface Listing {
  id: string;
  title: string;
  category: ListingCategory;
  purpose: ListingPurpose;
  /** Harga jual aktual dalam Rupiah. Untuk kategori Sewa nilainya adalah harga per bulan. */
  price: number;
  /** Harga normal sebelum diskon. Kosong bila produk tidak sedang diskon. */
  originalPrice?: number;
  location: string;
  city: string;
  /** Koordinat lokasi properti, dipakai untuk menghitung jarak ke pembeli. */
  coords?: GeoCoords | null;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  buildingArea: number;
  description: string;
  features: string[];
  /** URL gambar, data URL hasil upload, atau string kosong untuk memakai placeholder. */
  imageUrl: string;
  /** Foto galeri tambahan (maks. `MAX_GALLERY_IMAGES`). Foto utama tetap di `imageUrl`. */
  images?: string[];
  ownerId: string;
  ownerName: string;
  contactPhone: string;
  createdAt: string;
  aiGenerated?: boolean;
  /** ---- Atribut marketplace (opsional, kompatibel dengan data lama) ---- */
  stock?: number;
  sold?: number;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  storeName?: string;
  condition?: 'Baru' | 'Bekas';
  variations?: ListingVariation[];
  freeShipping?: boolean;
  cashbackPercent?: number;
  minOrder?: number;
  /** Flash sale: harga khusus dan stok terbatas. */
  flashSale?: boolean;
  flashPrice?: number;
  flashStock?: number;
}

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  name: string;
  phone: string;
  message: string;
  createdAt: string;
  read?: boolean;
  /** Pengirim (uid akun), dipakai aturan Firestore. */
  fromUid?: string;
  /** Penerima/pemilik properti (uid akun). */
  toUid?: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  /** Alamat lengkap pembeli, dipakai untuk menghitung jarak ke properti. */
  address?: string;
  /** Koordinat alamat pembeli. */
  coords?: GeoCoords | null;
}

/* ---------- Belanja: keranjang, alamat, pesanan, voucher, ulasan ---------- */

export interface CartItem {
  /** ID baris unik: listing + varian. */
  id: string;
  listingId: string;
  qty: number;
  variation?: string;
  selected: boolean;
  addedAt: string;
}

export interface Address {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  detail: string;
  city: string;
  postalCode?: string;
  coords?: GeoCoords | null;
  isDefault: boolean;
}

export const ORDER_STATUSES = ['belum-dibayar', 'dikemas', 'dikirim', 'selesai', 'dibatalkan'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ShippingMethod {
  id: string;
  label: string;
  eta: string;
  price: number;
  description: string;
}

export interface OrderItem {
  listingId: string;
  title: string;
  imageUrl: string;
  price: number;
  qty: number;
  variation?: string;
  /** True bila baris ini dibeli dengan harga flash sale. */
  isFlash?: boolean;
  ownerId: string;
  ownerName: string;
  category: string;
}

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  code: string;
  items: OrderItem[];
  /** Daftar listing unik di pesanan; dipakai untuk verifikasi ulasan. */
  listingIds?: string[];
  subtotal: number;
  discount: number;
  shipping: number;
  cashback: number;
  voucherCode?: string;
  total: number;
  status: OrderStatus;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  shippingMethod: string;
  /** ID metode pengiriman; dipakai server untuk menghitung ulang ongkir. */
  shippingMethodId?: string;
  paymentMethod: string;
  /** ID metode pembayaran; dipakai server saat impor pesanan lama. */
  paymentMethodId?: string;
  /** Provider pembayaran online, mis. "midtrans". Kosong untuk COD. */
  paymentProvider?: string;
  paymentStatus?: OrderPaymentStatus;
  /** Token/referensi transaksi dari provider. */
  paymentRef?: string;
  paymentUrl?: string;
  /** Jenis pembayaran dari provider, mis. "bank_transfer" atau "qris". */
  paymentType?: string;
  paymentCreatedAt?: string;
  note?: string;
  /** uid pembeli, atau 'guest' untuk checkout tanpa masuk. */
  buyerUid: string;
  buyerName: string;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
}

export type VoucherType = 'diskon' | 'ongkir' | 'cashback';

export interface Voucher {
  id: string;
  code: string;
  title: string;
  type: VoucherType;
  /** Potongan rupiah untuk tipe diskon/ongkir; nilai rupiah cashback bila ada. */
  amount: number;
  /** Persentase potongan (diskon) atau persentase cashback (cashback). */
  percent?: number;
  maxDiscount?: number;
  minSpend: number;
  description: string;
  /** Tanggal kedaluwarsa ISO (YYYY-MM-DD). */
  expiry: string;
  storeName?: string;
  color?: 'brand' | 'navy' | 'amber' | 'rose';
}

export interface ProductReview {
  id: string;
  listingId: string;
  /** Pesanan selesai yang menjadi dasar ulasan (wajib untuk ulasan baru). */
  orderId?: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
  /** Penulis ulasan (uid akun), dipakai aturan Firestore. */
  authorUid?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  cta: string;
  to: string;
  badge?: string;
  tone?: 'brand' | 'navy' | 'dark' | 'amber';
}

export interface StoreInfo {
  ownerId: string;
  name: string;
  city: string;
  listingCount: number;
  rating: number;
  sold: number;
  imageUrl: string;
}

/** Data belanja yang tersimpan per akun (atau keranjang tamu). */
export interface ShoppingData {
  cart: CartItem[];
  addresses: Address[];
  claimedVoucherCodes: string[];
}

/** Data yang dimiliki satu akun. Dipisah per uid agar tidak tercampur. */
export interface AccountData extends ShoppingData {
  /** Peran akun: pembeli atau penjual. Akun lama dianggap pembeli. */
  role: UserRole;
  /** Terisi setelah penjual melengkapi kriteria pendaftaran penjual. */
  seller?: SellerProfile;
  listings: Listing[];
  favorites: string[];
  inquiries: Inquiry[];
  profile: Profile;
}

/** Data platform yang dibagi bersama di peramban ini (promo & pengaturan admin). */
export interface PlatformData {
  vouchers: Voucher[];
  banners: Banner[];
  orders: Order[];
  reviews: ProductReview[];
  listingOverrides: Record<string, Partial<Listing>>;
  categoryLabels: Record<string, string>;
  hiddenCategories: string[];
}

/** Bagian PlatformData yang dibagi ke semua pengguna lewat Firestore. */
export interface SharedPlatform {
  vouchers: Voucher[];
  banners: Banner[];
  listingOverrides: Record<string, Partial<Listing>>;
  categoryLabels: Record<string, string>;
  hiddenCategories: string[];
}

/** Pengguna yang sedang masuk, disalin dari objek Firebase User. */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

/* ---------- Kontrak API AI (dipakai bersama oleh klien dan server) ---------- */

export const DESCRIPTION_TONES = ['Profesional', 'Santai', 'Mewah', 'Investasi'] as const;
export type DescriptionTone = (typeof DESCRIPTION_TONES)[number];

export interface DescriptionRequest {
  title: string;
  price: number;
  location: string;
  city: string;
  category: string;
  purpose: string;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  buildingArea: number;
  features: string[];
  details: string;
  tone: DescriptionTone;
}

export interface DescriptionResponse {
  description: string;
  /** 'template' berarti server memakai draf offline karena kunci AI belum diatur. */
  source: 'ai' | 'template';
  /** Model yang benar-benar dipakai; berguna saat server beralih ke model cadangan. */
  model?: string;
  note?: string;
}

export type ImageMode = 'room-makeover' | 'land-to-house' | 'renovation' | 'furniture';

export interface ImageRequest {
  mode: ImageMode;
  prompt: string;
  /** Data URL gambar sumber yang diunggah pengguna. */
  image: string;
}

export interface ImageResponse {
  image: string;
  note?: string;
}

export interface RabItem {
  id: string;
  name: string;
  category: 'Furniture' | 'Elektronik' | 'Dekorasi' | 'Finishing & Cat' | 'Struktur' | 'Jasa';
  price: number;
  qty: number;
  unit: string;
  included: boolean;
}

export interface AnalyzeImageRequest {
  /** Data URL gambar hasil generate AI (base64). */
  image: string;
  /** Dimensi ruangan untuk membantu estimasi harga satuan. */
  panjang?: number;
  lebar?: number;
}

export interface AnalyzeImageResponse {
  items: Omit<RabItem, 'id' | 'included'>[];
  /** 'ai' bila Gemini berhasil, 'fallback' bila gagal dan kita pakai default. */
  source: 'ai' | 'fallback';
}

export interface HealthResponse {
  /** Status kesiapan server; saat ini selalu 'ok' bila server merespons. */
  status?: 'ok';
  version?: string;
  uptimeSeconds?: number;
  timestamp?: string;
  logLevel?: string;
  aiEnabled: boolean;
  textModel: string;
  imageModel: string;
  /** Penyedia yang dipakai untuk fitur gambar: Cloudflare, Gemini, atau belum ada. */
  imageProvider?: 'cloudflare' | 'gemini' | 'none';
  /** Driver penyimpanan foto: Cloudinary untuk cloud permanen, atau disk lokal. */
  storageDriver?: 'cloudinary' | 'local';
  /** True bila server mewajibkan token App Check pada endpoint AI/unggah. */
  appCheckRequired?: boolean;
  /** Penyimpanan kuota AI yang dikonfigurasi server: auto, memory, atau firestore. */
  quotaBackend?: string;
}
