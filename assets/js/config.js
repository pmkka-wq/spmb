/**
 * assets/js/config.js
 * SPMB Mudacil — konfigurasi frontend, dipakai oleh api.js.
 *
 * WAJIB dimuat SEBELUM api.js di setiap halaman HTML, contoh:
 *   <script src="assets/js/config.js"></script>
 *   <script src="assets/js/api.js"></script>
 *
 * Isi `apiUrl` SETELAH deploy Web App di Apps Script (Deploy ▸ New
 * deployment ▸ Web app). Bentuknya seperti:
 *   https://script.google.com/macros/s/AKfycbx.../exec
 */

const APP_CONFIG = {
    // GANTI dengan URL Web App hasil deploy Apps Script (langkah 7 setup).
    apiUrl: "GANTI_DENGAN_URL_WEB_APP_APPS_SCRIPT",

    // Batas ukuran upload dokumen/bukti pembayaran (MB) — samakan dengan
    // Bagian 17 Master Context (dokumen jpg/jpeg/png/pdf maks 2MB).
    maxUploadMB: 1,
};
