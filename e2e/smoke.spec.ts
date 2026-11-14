import { expect, test } from '@playwright/test';

test('beranda tampil dengan navigasi utama', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PROPERTIKA AI/);
  await expect(page.getByRole('link', { name: 'Beranda' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FLASH SALE' })).toBeVisible();
});

test('katalog dapat dicari dan menampilkan hasil kosong', async ({ page }) => {
  await page.goto('/properti');
  await expect(page.getByRole('heading', { name: 'Daftar Properti' })).toBeVisible();

  const search = page.getByLabel('Cari listing');
  await search.fill('properti-yang-tidak-ada-123');
  await expect(page.getByText('Tidak ada produk yang cocok')).toBeVisible();
});

test('detail properti dapat menambahkan produk ke keranjang', async ({ page }) => {
  await page.goto('/properti/seed-1');
  await expect(
    page.getByRole('heading', { name: 'Rumah Modern Minimalis di Bintaro' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Tambah ke Keranjang/i }).click();

  await page.goto('/keranjang');
  await expect(page.getByRole('heading', { name: 'Keranjang Belanja' })).toBeVisible();
  await expect(page.getByText('Rumah Modern Minimalis di Bintaro').first()).toBeVisible();
});

test('kalkulator KPR dan halaman legal dapat dibuka', async ({ page }) => {
  await page.goto('/kalkulator-kpr');
  await expect(page.getByRole('heading', { name: 'Kalkulator KPR' })).toBeVisible();

  await page.goto('/syarat-ketentuan');
  await expect(page.getByRole('heading', { name: /Syarat & Ketentuan/i })).toBeVisible();

  await page.goto('/kebijakan-privasi');
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi' })).toBeVisible();

  await page.goto('/tentang-kami');
  await expect(page.getByRole('heading', { name: /Tentang/i }).first()).toBeVisible();
});

test('alamat yang tidak dikenal menampilkan halaman 404', async ({ page }) => {
  await page.goto('/rute-yang-tidak-ada');
  await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kembali ke beranda' })).toBeVisible();
});