import type { Inquiry } from '../types';

/**
 * Memainkan nada dering notifikasi singkat (dua nada harmonis)
 * menggunakan Web Audio API tanpa membutuhkan file audio eksternal.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Nada pertama (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Nada kedua (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch {
    // Browser mungkin membatasi audio sebelum interaksi pengguna pertama.
  }
}

/**
 * Meminta izin browser untuk menampilkan notifikasi desktop.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Menampilkan notifikasi sistem / browser desktop jika izin sudah diberikan.
 */
export function showBrowserNotification(
  title: string,
  options?: { body?: string; onClick?: () => void }
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(title, {
      body: options?.body,
      icon: '/favicon.ico',
    });

    if (options?.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick?.();
        notif.close();
      };
    }
  } catch {
    // Mengabaikan error jika browser memblokir notifikasi
  }
}

/**
 * Memicu notifikasi lengkap (suara + browser notification) untuk pesan masuk baru.
 */
export function notifyIncomingMessage(inquiry: Inquiry, onClick?: () => void): void {
  playNotificationSound();
  showBrowserNotification(`Pesan Masuk: ${inquiry.name}`, {
    body: `${inquiry.listingTitle}\n"${inquiry.message}"`,
    onClick,
  });
}
