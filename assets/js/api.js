/**
 * assets/js/api.js
 * SPMB Mudacil — Tahun Ajaran 2627
 *
 * SATU-SATUNYA file yang boleh melakukan fetch/request ke Apps Script.
 * File lain DILARANG melakukan fetch sendiri.
 *
 * Semua method mengembalikan Promise<{ ok, pesan, data }>.
 * Jika terjadi network error, method melempar Error — tangani di pemanggil.
 *
 * Perubahan pada revisi ini (lihat CHECKPOINT.md sesi berjalan):
 *  1. FIX PENTING: login() sebelumnya mengirim `pin` mentah, padahal
 *     code.gs/auth.gs mengharapkan `pinHash` (SHA-256 hex, dihitung di
 *     client). Tanpa fix ini login TIDAK PERNAH berhasil. Ditambahkan
 *     _sha256Hex() via Web Crypto API (tersedia native di browser modern,
 *     tanpa library eksternal — nol beban tambahan).
 *  2. Session client-aware: token disimpan bersama waktu kedaluwarsa (8
 *     jam, sinkron dengan SESSION_DURATION_SECONDS di auth.gs) supaya
 *     halaman bisa redirect ke login TANPA harus panggil verifyToken
 *     dulu kalau token sudah pasti basi (mengurangi 1 round-trip).
 *  3. Cache client (Bagian 18.1): getConfig/getWilayahLokal/
 *     getReferensiSekolah di-cache di sessionStorage dengan TTL, supaya
 *     pindah halaman (multi-page site, bukan SPA) tidak selalu memanggil
 *     Apps Script ulang untuk data yang jarang berubah. Data individual
 *     (status, dokumen, pembayaran) SENGAJA TIDAK di-cache.
 *  4. uploadBuktiPembayaran() sekarang mengirim metode & nominal (dulu
 *     hilang, padahal wajib di uploadBuktiPembayaranHandler).
 */

const API = (() => {

    const KUNCI_TOKEN = "SPMB_TOKEN";
    const KUNCI_TOKEN_EXPIRES = "SPMB_TOKEN_EXPIRES";
    const KUNCI_ROLE = "SPMB_ROLE";
    const KUNCI_NO_PENDAFTARAN = "SPMB_NO_PENDAFTARAN";
    const KUNCI_NAMA = "SPMB_NAMA";
    // Disamakan dgn SESSION_DURATION_SECONDS di auth.gs — CacheService Apps
    // Script punya batas keras 6 jam (21600 detik), bukan 8 jam.
    const SESI_DURASI_MS = 6 * 60 * 60 * 1000; // 6 jam — samakan dgn auth.gs

    // -------------------------------------------------------------------------
    // SESSION (client-side bookkeeping — sumber kebenaran TETAP di server)
    // -------------------------------------------------------------------------

    function _getToken() {
        return localStorage.getItem(KUNCI_TOKEN) || null;
    }

    function _simpanSesi(token, role, noPendaftaran, nama) {
        localStorage.setItem(KUNCI_TOKEN, token);
        localStorage.setItem(KUNCI_TOKEN_EXPIRES, String(Date.now() + SESI_DURASI_MS));
        if (role) localStorage.setItem(KUNCI_ROLE, role);
        if (noPendaftaran) localStorage.setItem(KUNCI_NO_PENDAFTARAN, noPendaftaran);
        if (nama) localStorage.setItem(KUNCI_NAMA, nama);
    }

    function _hapusSesi() {
        localStorage.removeItem(KUNCI_TOKEN);
        localStorage.removeItem(KUNCI_TOKEN_EXPIRES);
        localStorage.removeItem(KUNCI_ROLE);
        localStorage.removeItem(KUNCI_NO_PENDAFTARAN);
        localStorage.removeItem(KUNCI_NAMA);
    }

    /**
     * Cek kedaluwarsa MURNI di client (UX — hindari panggil server kalau
     * sudah pasti basi). Server (CacheService, auth.gs) tetap sumber
     * kebenaran final; kalau ternyata client jam-nya beda, server yang
     * akan menolak lewat requireSession().
     * @returns {boolean}
     */
    function sesiKedaluwarsaClient() {
        const exp = localStorage.getItem(KUNCI_TOKEN_EXPIRES);
        if (!exp) return true;
        return Date.now() > Number(exp);
    }

    function sesiInfo() {
        return {
            token: _getToken(),
            role: localStorage.getItem(KUNCI_ROLE) || null,
            noPendaftaran: localStorage.getItem(KUNCI_NO_PENDAFTARAN) || null,
            nama: localStorage.getItem(KUNCI_NAMA) || null,
            adaToken: !!_getToken() && !sesiKedaluwarsaClient(),
        };
    }

    // -------------------------------------------------------------------------
    // HASH SHA-256 (client) — HARUS sama format dgn hashSHA256Hex() di auth.gs
    // -------------------------------------------------------------------------

    async function _sha256Hex(teks) {
        const data = new TextEncoder().encode(String(teks));
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(function (b) { return b.toString(16).padStart(2, "0"); })
            .join("");
    }

    // -------------------------------------------------------------------------
    // CACHE CLIENT (Bagian 18.1) — sessionStorage, hanya utk data referensi
    // yang "jarang berubah". TIDAK dipakai utk status/dokumen/pembayaran.
    // -------------------------------------------------------------------------

    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit, samakan dgn cache server CONFIG

    function _cacheGet(kunci) {
        try {
            const raw = sessionStorage.getItem("SPMB_CACHE_" + kunci);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() > parsed.exp) {
                sessionStorage.removeItem("SPMB_CACHE_" + kunci);
                return null;
            }
            return parsed.val;
        } catch (err) {
            return null;
        }
    }

    function _cacheSet(kunci, val, ttlMs) {
        try {
            sessionStorage.setItem("SPMB_CACHE_" + kunci, JSON.stringify({
                val: val,
                exp: Date.now() + (ttlMs || CACHE_TTL_MS),
            }));
        } catch (err) {
            // Kalau sessionStorage penuh/diblokir browser, diamkan saja —
            // caching cuma optimisasi, bukan kebutuhan fungsional.
        }
    }

    /**
     * Bungkus panggilan API publik yang datanya jarang berubah dengan cache.
     * @param {string} kunci - kunci unik cache
     * @param {Function} fnPanggil - fungsi async yang benar2 panggil server
     */
    async function _denganCache(kunci, fnPanggil) {
        const cached = _cacheGet(kunci);
        if (cached) return cached;
        const hasil = await fnPanggil();
        if (hasil && hasil.ok) _cacheSet(kunci, hasil);
        return hasil;
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS — request dasar
    // -------------------------------------------------------------------------

    async function _get(params = {}, withAuth = false) {
        const url = new URL(APP_CONFIG.apiUrl);

        if (withAuth) {
            const token = _getToken();
            if (!token || sesiKedaluwarsaClient()) {
                _hapusSesi();
                return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
            }
            params.token = token;
        }

        Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

        // Retry SEKALI khusus GET (aman diulang, tidak ada efek samping)
        // kalau gagal jaringan/5xx/404 — Apps Script Web App kadang
        // mengalami hiccup transien (redirect script.google.com ->
        // script.googleusercontent.com, cold start) yang hilang sendiri
        // kalau dicoba ulang sebentar lagi.
        for (let percobaan = 0; percobaan < 2; percobaan++) {
            try {
                const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
                if (!response.ok) {
                    if (percobaan === 0 && (response.status === 404 || response.status >= 500)) {
                        await new Promise((r) => setTimeout(r, 800));
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            } catch (err) {
                if (percobaan === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
                throw err;
            }
        }
    }

    async function _post(body = {}, withAuth = false) {
        if (withAuth) {
            const token = _getToken();
            if (!token || sesiKedaluwarsaClient()) {
                _hapusSesi();
                return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
            }
            body.token = token;
        }

        // POST TIDAK di-retry otomatis (beda dari _get) — mengulang POST
        // yang sudah terkirim berisiko duplikasi efek samping (mis. dobel
        // catat pembayaran). submitPendaftaran sudah py idempotency sendiri
        // (submissionId), tapi action lain belum tentu — lebih aman gagal
        // sekali & biarkan pengguna coba lagi manual lewat tombol.
        const response = await fetch(APP_CONFIG.apiUrl, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain" }, // Apps Script butuh text/plain agar tidak trigger CORS preflight
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Konversi File -> base64 murni (tanpa prefix "data:...;base64,").
     * Upload file DIKIRIM LEWAT JSON (bukan multipart/FormData) karena
     * e.parameter.file di Apps Script Web App terbukti TIDAK bisa
     * diandalkan (kadang datang bukan Blob valid) — ini penyebab bug
     * "File tidak valid" & BUKTI_URL kosong di Spreadsheet. Base64 lewat
     * JSON konsisten dengan jalur _post yang sudah dipakai di seluruh
     * app, dan Utilities.newBlob() di server merekonstruksi Blob asli.
     * @param {File} file
     * @returns {Promise<string>}
     */
    /**
     * Kompres gambar (jpg/png) di browser via <canvas> sebelum upload,
     * target ukuran akhir ~1MB. PDF TIDAK dikompres (butuh library khusus,
     * di luar cakupan — PDF besar cukup ditolak validasi ukuran biasa).
     * Turunkan quality JPEG bertahap, lalu perkecil dimensi kalau masih
     * kebesaran. Mengembalikan File baru, atau file asli kalau sudah
     * di bawah target / bukan gambar / canvas gagal (tidak pernah
     * menggagalkan upload hanya karena kompresi gagal).
     * @param {File} file
     * @param {number} targetBytes
     * @returns {Promise<File>}
     */
    function _kompresGambar(file, targetBytes) {
        targetBytes = targetBytes || 1024 * 1024;
        if (!file.type || file.type.indexOf("image/") !== 0 || file.size <= targetBytes) return Promise.resolve(file);

        return new Promise(function (resolve) {
            const img = new Image();
            const urlAsal = URL.createObjectURL(file);
            img.onload = function () {
                URL.revokeObjectURL(urlAsal);
                let lebar = img.naturalWidth, tinggi = img.naturalHeight;
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                function render(skala) {
                    canvas.width = Math.round(lebar * skala);
                    canvas.height = Math.round(tinggi * skala);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                function cobaKualitas(kualitas, skala, sisaPercobaan) {
                    render(skala);
                    canvas.toBlob(function (blob) {
                        if (!blob) { resolve(file); return; }
                        if (blob.size <= targetBytes || sisaPercobaan <= 0) {
                            resolve(new File([blob], file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" }));
                            return;
                        }
                        // Masih kebesaran: turunkan quality dulu, kalau sudah rendah turunkan dimensi.
                        const kualitasBaru = kualitas > 0.4 ? kualitas - 0.15 : kualitas;
                        const skalaBaru = kualitas > 0.4 ? skala : skala * 0.8;
                        cobaKualitas(kualitasBaru, skalaBaru, sisaPercobaan - 1);
                    }, "image/jpeg", kualitas);
                }
                cobaKualitas(0.85, 1, 6);
            };
            img.onerror = function () { URL.revokeObjectURL(urlAsal); resolve(file); };
            img.src = urlAsal;
        });
    }

    function _fileKeBase64(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                const hasil = String(reader.result || "");
                const koma = hasil.indexOf(",");
                resolve(koma === -1 ? hasil : hasil.slice(koma + 1));
            };
            reader.onerror = function () { reject(new Error("Gagal membaca file.")); };
            reader.readAsDataURL(file);
        });
    }

    async function _postFormData(formData) {
        const token = _getToken();
        if (!token || sesiKedaluwarsaClient()) {
            _hapusSesi();
            return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
        }
        formData.append("token", token);

        const response = await fetch(APP_CONFIG.apiUrl, {
            method: "POST",
            redirect: "follow",
            body: formData,
            // Content-Type JANGAN di-set manual — browser otomatis set boundary multipart
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    // -------------------------------------------------------------------------
    // AUTH
    // -------------------------------------------------------------------------

    /**
     * Login pendaftar. PIN di-hash SHA-256 di client SEBELUM dikirim
     * (server membandingkan langsung ke PIN_HASH, tidak hash ulang).
     * @param {string} noHp
     * @param {string} noPendaftaran
     * @param {string} pin - PIN mentah 6 digit dari input user
     */
    async function login(noHp, noPendaftaran, pin) {
        const pinHash = await _sha256Hex(pin);
        const hasil = await _post({ action: "login", noHp, noPendaftaran, pinHash });
        if (hasil.ok && hasil.data && hasil.data.token) {
            _simpanSesi(hasil.data.token, hasil.data.role, hasil.data.noPendaftaran);
        }
        return hasil;
    }

    async function logout() {
        try {
            const hasil = await _post({ action: "logout" }, true);
            _hapusSesi();
            return hasil;
        } catch (err) {
            _hapusSesi();
            throw err;
        }
    }

    /**
     * Hapus sesi LOKAL saja (localStorage), SINKRON, tanpa menunggu server.
     * WAJIB dipanggil sebelum redirect ke login.html — kalau tidak, token
     * lama masih ada saat login.html cek sesiInfo().adaToken dan langsung
     * redirect balik ke dashboard (bug "klik Keluar tidak pernah benar-benar
     * keluar" / loop). Panggilan logout() ke server boleh menyusul di background.
     */
    function hapusSesiLokal() { _hapusSesi(); }

    async function verifyToken() {
        return _get({ action: "verifyToken" }, true);
    }

    // -------------------------------------------------------------------------
    // STATUS GERBANG & REFERENSI (public, di-cache client — Bagian 18.1)
    // -------------------------------------------------------------------------

    async function cekStatus() {
        // TIDAK di-cache lama (gerbang bisa berubah kapan saja oleh admin) —
        // tapi tetap dedup dalam 1 sesi tab lewat cache pendek 60 detik
        // supaya reload cepat berturut-turut tidak membombardir server.
        return _denganCache("cekStatus", function () { return _get({ action: "cekStatus" }); });
    }

    async function getConfig() {
        return _denganCache("getConfig", function () { return _get({ action: "getConfig" }); });
    }

    async function getWilayahLokal(level, induk) {
        return _denganCache("wilayah_" + level + "_" + induk, function () {
            return _get({ action: "getWilayahLokal", level, induk });
        });
    }

    async function getReferensiSekolah() {
        return _denganCache("referensiSekolah", function () { return _get({ action: "getReferensiSekolah" }); });
    }

    async function getPengumuman(gelombang) {
        // SENGAJA TIDAK di-cache (beda dari CONFIG/wilayah/referensi): isinya
        // jarang berubah tapi HARUS langsung terasa begitu admin menerbitkan
        // pengumuman baru — sebelumnya cache 5 menit bikin pengumuman baru
        // seolah "tidak muncul" padahal sudah tersimpan di sheet. Payload-nya
        // kecil jadi biaya round-trip tambahan ini dapat diabaikan.
        return _get(gelombang ? { action: "getPengumuman", gelombang } : { action: "getPengumuman" });
    }

    // -------------------------------------------------------------------------
    // PENDAFTAR
    // -------------------------------------------------------------------------

    async function submitPendaftaran(dataPendaftar) {
        const submissionId = _generateUUID();
        return _post({
            action: "submitPendaftaran",
            submissionId,
            ...dataPendaftar,
        });
    }

    async function getProfile() {
        return _get({ action: "getProfile" }, true);
    }

    async function updateProfile(dataUpdate) {
        return _post({
            action: "updateProfile",
            ...dataUpdate,
        }, true);
    }

    async function submitSurvei(jawabanAlasan, jawabanSumber, jawabanSumberDetail) {
        return _post({
            action: "submitSurvei",
            jawabanAlasan,
            jawabanSumber,
            jawabanSumberDetail: jawabanSumberDetail || "",
        }, true);
    }

    // -------------------------------------------------------------------------
    // DOKUMEN
    // -------------------------------------------------------------------------

    async function getDokumen() {
        return _get({ action: "getDokumen" }, true);
    }

    async function uploadDokumen(jenisDokumen, file) {
        file = await _kompresGambar(file, 1024 * 1024);
        const maxBytes = (APP_CONFIG.maxUploadMB || 2) * 1024 * 1024;
        if (file.size > maxBytes) {
            return { ok: false, pesan: `Ukuran file melebihi batas ${APP_CONFIG.maxUploadMB} MB.` };
        }

        const fileBase64 = await _fileKeBase64(file);
        return _post({
            action: "uploadDokumen",
            jenisDokumen,
            fileBase64,
            fileName: file.name,
            fileMimeType: file.type,
        }, true);
    }

    // -------------------------------------------------------------------------
    // PEMBAYARAN
    // -------------------------------------------------------------------------

    async function getPembayaran() {
        return _get({ action: "getPembayaran" }, true);
    }

    /**
     * @param {string} jenisPembayaran - "DP" | "Daftar Ulang"
     * @param {string} metode - "Transfer" | "Tunai"
     * @param {string|number} nominal
     * @param {File} [file] - opsional
     */
    async function uploadBuktiPembayaran(jenisPembayaran, metode, nominal, file) {
        const body = {
            action: "uploadBuktiPembayaran",
            jenisPembayaran,
            metode: metode || "Transfer",
            nominal: nominal || "",
        };
        if (file) {
            file = await _kompresGambar(file, 1024 * 1024);
            const maxBytes = (APP_CONFIG.maxUploadMB || 2) * 1024 * 1024;
            if (file.size > maxBytes) {
                return { ok: false, pesan: `Ukuran file melebihi batas ${APP_CONFIG.maxUploadMB} MB.` };
            }
            body.fileBase64 = await _fileKeBase64(file);
            body.fileName = file.name;
            body.fileMimeType = file.type;
        }

        return _post(body, true);
    }

    // -------------------------------------------------------------------------
    // ADMIN & PETUGAS
    // -------------------------------------------------------------------------

    async function adminGetPendaftar(filter = {}) {
        return _get({ action: "adminGetPendaftar", ...filter }, true);
    }

    /** Timestamp (ms) aktivitas terakhir — dipakai cek apakah cache list pendaftar basi. */
    async function adminLogTerakhir() {
        return _get({ action: "adminLogTerakhir" }, true);
    }

    async function adminGetDetail(noPendaftaran) {
        return _get({ action: "adminGetDetail", noPendaftaran }, true);
    }

    async function adminVerifikasiDokumen(dokumenId, statusBaru, catatan = "") {
        return _post({ action: "adminVerifikasiDokumen", dokumenId, statusBaru, catatan }, true);
    }

    async function adminUpdateStatus(noPendaftaran, statusBaru, catatan = "") {
        return _post({ action: "adminUpdateStatus", noPendaftaran, statusBaru, catatan }, true);
    }

    async function adminKonfirmasiPembayaran(paymentId, statusBaru, catatan = "", nominal = "") {
        return _post({ action: "adminKonfirmasiPembayaran", paymentId, statusBaru, catatan, nominal }, true);
    }

    async function adminUpdateConfig(key, value) {
        return _post({ action: "adminUpdateConfig", key, value }, true);
    }

    async function adminResetPIN(noPendaftaran, pinBaru) {
        return _post({ action: "adminResetPIN", noPendaftaran, pinBaru }, true);
    }

    /** Ambil isi file (dokumen/bukti) via server -> { base64, mime, nama }. jenis: 'dokumen' | 'bukti'. */
    async function getFile(jenis, id) {
        return _get({ action: "getFile", jenis, id }, true);
    }

    /** [PETUGAS/ADMIN] Catat pembayaran langsung (tunai/loket), otomatis Dikonfirmasi. */
    /** [PENDAFTAR] Isi nilai/prestasi yang masih kosong saja (field yang sudah terisi tidak tertimpa). */
    async function isiNilaiKosong(nilaiRapor, nilaiTka, prestasi) {
        return _post({ action: "isiNilaiKosong", nilaiRapor, nilaiTka, prestasi }, true);
    }

    async function adminInputPembayaran(noPendaftaran, jenisPembayaran, metode, nominal, catatan) {
        return _post({ action: "adminInputPembayaran", noPendaftaran, jenisPembayaran, metode, nominal, catatan: catatan || "" }, true);
    }

    /** [PETUGAS/ADMIN] Set potongan daftar ulang (input positif, server simpan negatif). */
    async function adminSetPotongan(noPendaftaran, potongan, keterangan) {
        return _post({ action: "adminSetPotongan", noPendaftaran, potongan, keterangan: keterangan || "" }, true);
    }

    /** [PETUGAS/ADMIN] Statistik dashboard (cache server 5 menit; refresh=true paksa hitung ulang). */
    async function adminStatistik(refresh) {
        return _get(refresh ? { action: "adminStatistik", refresh: "1" } : { action: "adminStatistik" }, true);
    }

    /** [PETUGAS/ADMIN] Daftar pengajuan perubahan data. semua=true untuk lihat yang sudah selesai juga. */
    async function adminGetPengajuan(semua) {
        return _get(semua ? { action: "adminGetPengajuan", semua: "1" } : { action: "adminGetPengajuan" }, true);
    }

    /** [PETUGAS/ADMIN] Tandai pengajuan Selesai/Ditolak. */
    async function adminSelesaikanPengajuan(pengajuanId, statusBaru, catatan) {
        return _post({ action: "adminSelesaikanPengajuan", pengajuanId, statusBaru, catatan: catatan || "" }, true);
    }

    /** [ADMIN] Daftar user petugas/admin (tanpa password/PIN). */
    async function adminGetUsers() {
        return _get({ action: "adminGetUsers" }, true);
    }

    /** [ADMIN] Tambah (userId kosong) / ubah user. password/pin kosong saat ubah = tidak diganti. */
    async function adminSimpanUser(data) {
        return _post(Object.assign({ action: "adminSimpanUser" }, data), true);
    }

    /** [ADMIN] Hapus log lebih tua dari 60/90/180 hari. konfirmasi harus "HAPUS". */
    async function adminBersihkanLog(hari, konfirmasi) {
        return _post({ action: "adminBersihkanLog", hari, konfirmasi }, true);
    }

    async function loginSekolah(email, password, pin) {
        const hasil = await _post({ action: "loginSekolah", email, password, pin });
        if (hasil.ok && hasil.data && hasil.data.token) {
            _simpanSesi(hasil.data.token, hasil.data.role, null, hasil.data.nama);
        }
        return hasil;
    }

    async function adminSimpanPengumuman(pengumumanId, judul, isi, aktif, link, targetGelombang) {
        return _post({
            action: "adminSimpanPengumuman",
            pengumumanId: pengumumanId || "",
            judul,
            isi: isi || "",
            aktif: aktif || "Ya",
            link: link || "",
            targetGelombang: targetGelombang || "",
        }, true);
    }

    // -------------------------------------------------------------------------
    // PRIVATE UTILITY
    // -------------------------------------------------------------------------

    function _generateUUID() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // -------------------------------------------------------------------------
    // PUBLIC INTERFACE
    // -------------------------------------------------------------------------

    return {
        // Session (client-side)
        sesiInfo,
        sesiKedaluwarsaClient,

        // Auth
        login,
        loginSekolah,
        logout,
        hapusSesiLokal,
        verifyToken,

        // Status gerbang & referensi
        cekStatus,
        getConfig,
        getWilayahLokal,
        getReferensiSekolah,
        getPengumuman,

        // Pendaftar
        submitPendaftaran,
        getProfile,
        updateProfile,
        submitSurvei,

        // Dokumen
        getDokumen,
        uploadDokumen,

        // Pembayaran
        getPembayaran,
        uploadBuktiPembayaran,

        // Admin & Petugas
        adminGetPendaftar,
        adminLogTerakhir,
        adminGetDetail,
        adminVerifikasiDokumen,
        adminUpdateStatus,
        adminKonfirmasiPembayaran,
        adminUpdateConfig,
        adminResetPIN,
        getFile,
        isiNilaiKosong,
        adminInputPembayaran,
        adminSetPotongan,
        adminStatistik,
        adminBersihkanLog,
        adminGetUsers,
        adminSimpanUser,
        adminGetPengajuan,
        adminSelesaikanPengajuan,
        adminSimpanPengumuman,
    };

})();
