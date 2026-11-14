import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { AuthProvider } from './lib/auth';

const HomePage = lazy(() => import('./pages/HomePage'));
const PropertiPage = lazy(() => import('./pages/PropertiPage'));
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const FlashSalePage = lazy(() => import('./pages/FlashSalePage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const VoucherPage = lazy(() => import('./pages/VoucherPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const FavoritPage = lazy(() => import('./pages/FavoritPage'));
const AIStudioPage = lazy(() => import('./pages/AIStudioPage'));
const AIDeskripsiPropertiPage = lazy(() => import('./pages/AIDeskripsiPropertiPage'));
const AIRoomMakeoverPage = lazy(() => import('./pages/AIRoomMakeoverPage'));
const AIFurnitureSimulatorPage = lazy(() =>
  import('./pages/AIImageToolPages').then((module) => ({ default: module.AIFurnitureSimulatorPage })),
);
const AIHomeRenovationPage = lazy(() =>
  import('./pages/AIImageToolPages').then((module) => ({ default: module.AIHomeRenovationPage })),
);
const AILandToHousePage = lazy(() =>
  import('./pages/AIImageToolPages').then((module) => ({ default: module.AILandToHousePage })),
);
const DaftarPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.DaftarPage })));
const DaftarPenjualPage = lazy(() =>
  import('./pages/AuthPages').then((module) => ({ default: module.DaftarPenjualPage })),
);
const LupaSandiPage = lazy(() =>
  import('./pages/AuthPages').then((module) => ({ default: module.LupaSandiPage })),
);
const MasukPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.MasukPage })));
const MasukPenjualPage = lazy(() =>
  import('./pages/AuthPages').then((module) => ({ default: module.MasukPenjualPage })),
);
const KalkulatorKPRPage = lazy(() => import('./pages/KalkulatorKPRPage'));
const DashboardUser = lazy(() => import('./pages/DashboardUser'));
const DashboardSeller = lazy(() => import('./pages/DashboardSeller'));
const JadiPenjualPage = lazy(() => import('./pages/JadiPenjualPage'));
const SyaratKetentuanPage = lazy(() => import('./pages/SyaratKetentuanPage'));
const KebijakanPrivasiPage = lazy(() => import('./pages/KebijakanPrivasiPage'));
const TentangKamiPage = lazy(() => import('./pages/TentangKamiPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 pb-20 md:pb-0">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/properti" element={<PropertiPage />} />
                  <Route path="/properti/:id" element={<PropertyDetailPage />} />
                  <Route path="/kategori" element={<CategoryPage />} />
                  <Route path="/flash-sale" element={<FlashSalePage />} />
                  <Route path="/keranjang" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/pesanan" element={<OrdersPage />} />
                  <Route path="/pesanan/:id" element={<OrderDetailPage />} />
                  <Route path="/akun" element={<AccountPage />} />
                  <Route path="/voucher" element={<VoucherPage />} />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminPage />
                      </AdminRoute>
                    }
                  />

                  <Route
                    path="/sewa"
                    element={
                      <MarketplacePage
                        title="Properti Disewa"
                        subtitle="Rumah dan apartemen yang tersedia untuk disewa"
                        purpose="Disewa"
                      />
                    }
                  />
                  <Route
                    path="/tanah"
                    element={
                      <MarketplacePage
                        title="Tanah"
                        subtitle="Kavling siap bangun di berbagai lokasi"
                        category="Tanah"
                      />
                    }
                  />
                  <Route
                    path="/furniture"
                    element={
                      <MarketplacePage
                        title="Furniture"
                        subtitle="Perabot pilihan untuk melengkapi hunian"
                        category="Furniture"
                      />
                    }
                  />

                  <Route path="/masuk" element={<MasukPage />} />
                  <Route path="/masuk-penjual" element={<MasukPenjualPage />} />
                  <Route path="/daftar" element={<DaftarPage />} />
                  <Route path="/daftar-penjual" element={<DaftarPenjualPage />} />
                  <Route path="/lupa-sandi" element={<LupaSandiPage />} />

                  <Route
                    path="/favorit"
                    element={
                      <ProtectedRoute>
                        <FavoritPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/ai-studio" element={<AIStudioPage />} />
                  <Route
                    path="/ai-deskripsi"
                    element={
                      <ProtectedRoute>
                        <AIDeskripsiPropertiPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai-room-makeover"
                    element={
                      <ProtectedRoute>
                        <AIRoomMakeoverPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai-land-to-house"
                    element={
                      <ProtectedRoute>
                        <AILandToHousePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai-home-renovation"
                    element={
                      <ProtectedRoute>
                        <AIHomeRenovationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai-furniture-simulator"
                    element={
                      <ProtectedRoute>
                        <AIFurnitureSimulatorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/kalkulator-kpr" element={<KalkulatorKPRPage />} />

                  <Route
                    path="/dashboard-user"
                    element={
                      <ProtectedRoute role="buyer">
                        <DashboardUser />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/jadi-penjual"
                    element={
                      <ProtectedRoute role="buyer">
                        <JadiPenjualPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard-seller"
                    element={
                      <ProtectedRoute role="seller">
                        <DashboardSeller />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/syarat-ketentuan" element={<SyaratKetentuanPage />} />
                  <Route path="/kebijakan-privasi" element={<KebijakanPrivasiPage />} />
                  <Route path="/tentang-kami" element={<TentangKamiPage />} />

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <BottomNav />
            <Toast />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
