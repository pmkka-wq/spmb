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
    apiUrl: "https://script.google.com/macros/s/AKfycbz59u-nHOugJTpROlpCpUtolwid-O_NEOq8UZPKIRzB8HPW69ev6M96sLKu4c3gcphQ/exec",

    // Batas ukuran upload dokumen/bukti pembayaran (MB) — samakan dengan
    // Bagian 17 Master Context (dokumen jpg/jpeg/png/pdf maks 2MB).
    maxUploadMB: 2,
};
