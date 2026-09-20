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
 * REVISI (sesuai Master Context v2, Bagian 19 — FINAL/LOCKED):
 *   1. PIN pendaftar di-hash SHA-256 di client sebelum dikirim (Bagian 8).
 *      Perbandingan akhir tetap di server — ini hanya lapisan tambahan,
 *      bukan pengganti validasi server.
 *   2. Layer cache client untuk CONFIG / wilayah / referensi sekolah,
 *      disimpan di memori JS per sesi halaman (Bagian 18.1).
 *   3. submitPendaftaran() membuang field terkait dokumen dari payload —
 *      upload dokumen sudah dipindah ke pasca-submit (Aturan Bisnis #5).
 *   4. Session token disertai waktu kedaluwarsa 8 jam yang dicek di client
 *      juga (bukan cuma di server) — pola sama untuk pendaftar & sekolah
 *      (Bagian 8, Bagian 19.5).
 */

const API = (() => {

    // -------------------------------------------------------------------------
    // KONSTANTA SESSION
    // -------------------------------------------------------------------------

    const TOKEN_KEY = "SPMB_TOKEN";
    const TOKEN_EXPIRES_KEY = "SPMB_TOKEN_EXPIRES";
    // 8 jam, selaras Bagian 8 & 19.5 — tidak ada token jangka panjang.
    const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

    // CATATAN PENTING (GitHub Pages multi-project di 1 username.github.io):
    // localStorage dibatasi browser per ORIGIN (protokol+domain), BUKAN per
    // path. Artinya username.github.io/spmb/ dan username.github.io/ppdb/
    // berbagi localStorage YANG SAMA — beda dengan cookie yang default-nya
    // terbatas per path. Prefix "SPMB_" di key ini mengurangi risiko
    // tabrakan nama key dengan project lain, TAPI BUKAN isolasi keamanan
    // sungguhan (script di /ppdb/ tetap bisa baca localStorage.getItem
    // ("SPMB_TOKEN") kalau tahu/menebak nama key-nya). Kalau isolasi
    // sungguhan dibutuhkan, satu-satunya cara pasti adalah custom domain
    // terpisah per project (beda origin = beda "wadah" localStorage sama
    // sekali, dijamin browser) — bukan sekadar penamaan key yang rapi.

    // -------------------------------------------------------------------------
    // CACHE CLIENT (Bagian 18.1) — in-memory, hilang saat reload halaman.
    // Data di sini SENGAJA tidak dipersist ke localStorage: cukup "per sesi
    // form/halaman berlangsung", sesuai spek, dan menghindari data basi
    // nyangkut lintas reload.
    // -------------------------------------------------------------------------

    const _cache = {
        config: null,
        wilayah: new Map(), // key: `${level}|${induk}` → array hasil
        sekolah: null,
    };

    /**
     * Kosongkan semua cache client. Panggil setelah adminUpdateConfig()
     * berhasil, atau kapan pun data acuan perlu dipaksa fresh.
     */
    function clearCache() {
        _cache.config = null;
        _cache.wilayah.clear();
        _cache.sekolah = null;
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS — SESSION
    // -------------------------------------------------------------------------

    /**
     * Simpan token + waktu kedaluwarsa (8 jam dari sekarang).
     * @param {string} token
     */
    function _setSession(token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + SESSION_DURATION_MS));
    }

    /**
     * Hapus token dari penyimpanan lokal (logout / expired).
     */
    function _clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRES_KEY);
    }

    /**
     * Ambil token dari localStorage — sekaligus cek kedaluwarsa 8 jam
     * di sisi client, supaya UI bisa langsung minta login ulang tanpa
     * perlu tunggu server menolak. Ini murni UX; server TETAP wajib
     * validasi ulang, sesuai Bagian 18.2.
     * @returns {string|null}
     */
    function _getToken() {
        const token = localStorage.getItem(TOKEN_KEY);
        const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0);

        if (!token || !expiresAt || Date.now() > expiresAt) {
            _clearSession();
            return null;
        }
        return token;
    }

    /**
     * Cek validitas session TANPA memanggil server (dipakai di halaman
     * ber-auth untuk redirect cepat sebelum render).
     * @returns {boolean}
     */
    function isSessionValid() {
        return _getToken() !== null;
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS — HASHING PIN (Bagian 8)
    // -------------------------------------------------------------------------

    /**
     * SHA-256 (hex, tanpa salt) — sesuai keputusan 19.2.
     * Butuh secure context (HTTPS/localhost); GitHub Pages sudah HTTPS.
     * @param {string} text
     * @returns {Promise<string>}
     */
    async function _sha256Hex(text) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS — FETCH
    // -------------------------------------------------------------------------

    /**
     * Base GET request ke Apps Script.
     * @param {Object} params  - key-value yang dijadikan query string
     * @param {boolean} withAuth - sertakan token di params
     * @returns {Promise<{ok, pesan, data}>}
     */
    async function _get(params = {}, withAuth = false) {
        const url = new URL(APP_CONFIG.apiUrl);

        if (withAuth) {
            const token = _getToken();
            if (!token) return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
            params.token = token;
        }

        Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

        const response = await fetch(url.toString(), {
            method: "GET",
            redirect: "follow",
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        if (withAuth) _handlePossibleSessionExpiry(json);
        return json;
    }

    /**
     * Base POST request ke Apps Script.
     * @param {Object} body    - payload JSON
     * @param {boolean} withAuth - sertakan token di body
     * @returns {Promise<{ok, pesan, data}>}
     */
    async function _post(body = {}, withAuth = false) {
        if (withAuth) {
            const token = _getToken();
            if (!token) return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
            body.token = token;
        }

        const response = await fetch(APP_CONFIG.apiUrl, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain" }, // Apps Script butuh text/plain agar tidak trigger CORS preflight
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        if (withAuth) _handlePossibleSessionExpiry(json);
        return json;
    }

    /**
     * POST multipart/form-data khusus upload file.
     * Apps Script menerima file via blob dalam FormData.
     * @param {FormData} formData
     * @returns {Promise<{ok, pesan, data}>}
     */
    async function _postFormData(formData) {
        const token = _getToken();
        if (!token) return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
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

        const json = await response.json();
        _handlePossibleSessionExpiry(json);
        return json;
    }

    /**
     * Kalau server bilang session sudah tidak valid/kedaluwarsa, bersihkan
     * token lokal supaya UI tidak terus-terusan mencoba pakai token basi.
     * Cakupan pesan sengaja longgar (kata kunci) karena kontrak pesan
     * pasti dari backend belum final saat file ini ditulis — sesuaikan
     * kalau nanti backend punya kode error terstruktur (mis. data.kode).
     * @param {{ok:boolean, pesan?:string}} json
     */
    function _handlePossibleSessionExpiry(json) {
        if (json && json.ok === false && typeof json.pesan === "string") {
            const pesanLower = json.pesan.toLowerCase();
            if (pesanLower.includes("sesi") || pesanLower.includes("session") || pesanLower.includes("kedaluwarsa") || pesanLower.includes("expired")) {
                _clearSession();
            }
        }
    }

    // -------------------------------------------------------------------------
    // AUTH
    // -------------------------------------------------------------------------

    /**
     * Login pendaftar.
     * PIN di-hash SHA-256 di client sebelum dikirim sebagai `pinHash`
     * (Bagian 8) — server membandingkan dengan PIN_HASH tersimpan.
     * @param {string} noHp
     * @param {string} noPendaftaran  - kosong string jika pendaftar baru
     * @param {string} pin
     * @returns {Promise<{ok, pesan, data: {token, role, noPendaftaran}}>}
     */
    async function login(noHp, noPendaftaran, pin) {
        const pinHash = await _sha256Hex(pin);
        const res = await _post({
            action: "login",
            noHp,
            noPendaftaran,
            pinHash,
        });

        if (res.ok && res.data && res.data.token) {
            _setSession(res.data.token);
        }
        return res;
    }

    /**
     * Login sekolah (petugas/admin): Email + Password + PIN.
     * PIN & Password TETAP plain text sesuai 19.3 (keputusan eksplisit) —
     * tidak di-hash di sini, hanya PIN pendaftar yang di-hash.
     * @param {string} email
     * @param {string} password
     * @param {string} pin
     * @returns {Promise<{ok, pesan, data: {token, role}}>}
     */
    async function loginSekolah(email, password, pin) {
        const res = await _post({
            action: "loginSekolah",
            email,
            password,
            pin,
        });

        if (res.ok && res.data && res.data.token) {
            _setSession(res.data.token);
        }
        return res;
    }

    /**
     * Login pendaftar via Google OAuth — cek email terdaftar di sheet PENDAFTAR.
     * @param {string} idToken - ID token dari Google Identity Services di frontend
     * @returns {Promise<{ok, pesan, data: {token, role, noPendaftaran}}>}
     */
    async function loginGooglePendaftar(idToken) {
        const res = await _post({ action: "loginGooglePendaftar", idToken });
        if (res.ok && res.data && res.data.token) {
            _setSession(res.data.token);
        }
        return res;
    }

    /**
     * Login sekolah (petugas/admin) via Google OAuth — cek email terdaftar di sheet USERS.
     * @param {string} idToken
     * @returns {Promise<{ok, pesan, data: {token, role, nama}}>}
     */
    async function loginGoogleSekolah(idToken) {
        const res = await _post({ action: "loginGoogleSekolah", idToken });
        if (res.ok && res.data && res.data.token) {
            _setSession(res.data.token);
        }
        return res;
    }

    /**
     * Logout — invalidate token di server, lalu selalu bersihkan token lokal
     * (walau request ke server gagal, jangan biarkan token basi tertinggal).
     * @returns {Promise<{ok, pesan}>}
     */
    async function logout() {
        let res;
        try {
            res = await _post({ action: "logout" }, true);
        } catch (err) {
            res = { ok: false, pesan: "Gagal menghubungi server, tapi sesi lokal tetap dihapus." };
        }
        _clearSession();
        return res;
    }

    /**
     * Verifikasi token masih valid (dipakai saat load halaman ber-auth).
     * Cek client dulu (cepat, tanpa network) sebelum tanya server.
     * @returns {Promise<{ok, pesan, data: {role, noPendaftaran}}>}
     */
    async function verifyToken() {
        if (!isSessionValid()) {
            return { ok: false, pesan: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali." };
        }
        return _get({ action: "verifyToken" }, true);
    }

    // -------------------------------------------------------------------------
    // STATUS GERBANG
    // -------------------------------------------------------------------------

    /**
     * Cek status pendaftaran: Ya / Offline / Tidak (Bagian 5).
     * Tidak butuh token — bisa dipanggil dari halaman publik.
     * @returns {Promise<{ok, pesan, data: {status, gelombang, tahunAjaran}}>}
     */
    async function cekStatus() {
        return _get({ action: "cekStatus" });
    }

    /**
     * Jalankan self-check backend dari luar editor Apps Script (Bagian 18.3).
     * Butuh kunciRahasia yang sama dengan CONFIG.SELF_CHECK_KEY di sheet.
     * @param {string} kunciRahasia
     * @returns {Promise<{ok, pesan, data: {totalCek, lolos, gagal, detailGagal}}>}
     */
    async function selfCheck(kunciRahasia) {
        return _post({ action: "selfCheck", kunciRahasia });
    }

    // -------------------------------------------------------------------------
    // DATA REFERENSI (CONFIG / WILAYAH / SEKOLAH) — cache client (Bagian 18.1)
    // -------------------------------------------------------------------------

    /**
     * Ambil CONFIG (semua key). Di-cache di memori JS per sesi halaman —
     * panggilan berikutnya tidak fetch ulang kecuali forceRefresh.
     * @param {boolean} forceRefresh
     * @returns {Promise<{ok, pesan, data: Object}>}
     */
    async function getConfig(forceRefresh = false) {
        if (!forceRefresh && _cache.config) {
            return { ok: true, pesan: "Dari cache", data: _cache.config };
        }
        const res = await _get({ action: "getConfig" });
        if (res.ok) {
            _cache.config = res.data;
        }
        return res;
    }

    /**
     * Ambil data wilayah bertingkat dari REFERENSI_WILAYAH (Bagian 15).
     * Di-cache per kombinasi level+induk, tidak pernah fetch ulang dalam
     * sesi yang sama karena data statis.
     * @param {string} level  - provinsi/kabupaten/kecamatan/desa
     * @param {string} induk  - kode parent, kosong untuk level teratas
     * @returns {Promise<{ok, pesan, data: Array}>}
     */
    async function getWilayahLokal(level, induk = "") {
        const cacheKey = `${level}|${induk}`;
        if (_cache.wilayah.has(cacheKey)) {
            return { ok: true, pesan: "Dari cache", data: _cache.wilayah.get(cacheKey) };
        }
        const res = await _get({ action: "getWilayahLokal", level, induk });
        if (res.ok) {
            _cache.wilayah.set(cacheKey, res.data);
        }
        return res;
    }

    /**
     * Ambil daftar REFERENSI_SEKOLAH (Bagian 6.6b) — dimuat sekali per sesi.
     * @param {boolean} forceRefresh
     * @returns {Promise<{ok, pesan, data: Array}>}
     */
    async function getReferensiSekolah(forceRefresh = false) {
        if (!forceRefresh && _cache.sekolah) {
            return { ok: true, pesan: "Dari cache", data: _cache.sekolah };
        }
        const res = await _get({ action: "getReferensiSekolah" });
        if (res.ok) {
            _cache.sekolah = res.data;
        }
        return res;
    }

    // -------------------------------------------------------------------------
    // PENDAFTAR
    // -------------------------------------------------------------------------

    /**
     * Submit final pendaftaran.
     * SUBMISSION_ID digenerate di sini (UUID v4) untuk idempotency.
     * Draft lokal HANYA dihapus oleh pemanggil jika ok === true.
     *
     * PENTING (Aturan Bisnis #5): upload dokumen sudah dipisah dari form
     * pendaftaran, dilakukan pasca-submit lewat uploadDokumen(). Karena
     * draft lokal (localStorage/IndexedDB) bisa saja masih menyimpan sisa
     * field dokumen dari versi form lama / state UI, field-field itu
     * SENGAJA dibuang di sini sebelum dikirim — bukan tanggung jawab
     * pemanggil untuk membersihkannya satu-satu.
     *
     * @param {Object} dataPendaftar - semua field dari draft (lihat Bagian 6.3 & 9)
     * @returns {Promise<{ok, pesan, data: {noPendaftaran}}>}
     */
    async function submitPendaftaran(dataPendaftar) {
        const {
            dokumen,
            dokumenList,
            dokumen_list,
            files,
            uploadedFiles,
            lampiran,
            ...dataBersih
        } = dataPendaftar || {};

        const submissionId = _generateUUID();
        return _post({
            action: "submitPendaftaran",
            submissionId,
            ...dataBersih,
        }, true);
    }

    /**
     * Ambil profil / data pendaftaran milik sendiri.
     * TIDAK di-cache — status individual harus selalu fresh (Bagian 18.1).
     * @returns {Promise<{ok, pesan, data: {pendaftar}}>}
     */
    async function getProfile() {
        return _get({ action: "getProfile" }, true);
    }

    /**
     * Update profil (hanya jika server mengizinkan berdasarkan status).
     * @param {Object} dataUpdate - field yang diubah
     * @returns {Promise<{ok, pesan}>}
     */
    async function updateProfile(dataUpdate) {
        return _post({
            action: "updateProfile",
            ...dataUpdate,
        }, true);
    }

    /**
     * Isi survei sumber info pendaftar (Bagian 3 poin 13, kartu opsional
     * di halaman sukses). Hanya bisa 1x per pendaftar, hanya kalau
     * CONFIG.FITUR_SURVEI_AKTIF = "Ya".
     *
     * `jawabanSumberDetail` hanya perlu diisi kalau `jawabanSumber` yang
     * dipilih ada di CONFIG.SURVEI_SUMBER_INFO_LIST_2 (mis. "Media Sosial"
     * atau "WhatsApp") — cek dulu lewat getConfig() sebelum menampilkan
     * dropdown kedua di form.
     * @param {Object} data - { jawabanAlasan, jawabanSumber, jawabanSumberDetail? }
     * @returns {Promise<{ok, pesan}>}
     */
    async function submitSurvei(data) {
        return _post({ action: "submitSurvei", ...data }, true);
    }

    // -------------------------------------------------------------------------
    // DOKUMEN
    // -------------------------------------------------------------------------

    /**
     * Ambil daftar dokumen milik pendaftar yang login.
     * TIDAK di-cache — harus selalu fresh (Bagian 18.1).
     * @returns {Promise<{ok, pesan, data: {dokumen[]}}>}
     */
    async function getDokumen() {
        return _get({ action: "getDokumen" }, true);
    }

    /**
     * Upload satu file dokumen.
     * Validasi ukuran dilakukan di sini sebelum dikirim (UX, bukan keamanan).
     *
     * @param {string} jenisDokumen  - IJAZAH | SKHUN | AKTA_LAHIR | KK | FOTO | SURAT_PINDAH
     * @param {File}   file          - objek File dari input[type=file]
     * @returns {Promise<{ok, pesan, data: {dokumenId, fileId, fileName}}>}
     */
    async function uploadDokumen(jenisDokumen, file) {
        // Validasi ukuran sisi klien (server tetap validasi ulang)
        const maxBytes = (APP_CONFIG.maxUploadMB || 2) * 1024 * 1024;
        if (file.size > maxBytes) {
            return {
                ok: false,
                pesan: `Ukuran file melebihi batas ${APP_CONFIG.maxUploadMB} MB.`,
            };
        }

        const formData = new FormData();
        formData.append("action", "uploadDokumen");
        formData.append("jenisDokumen", jenisDokumen);
        formData.append("file", file);

        return _postFormData(formData);
    }

    // -------------------------------------------------------------------------
    // PEMBAYARAN
    // -------------------------------------------------------------------------

    /**
     * Ambil info pembayaran milik pendaftar yang login.
     * TIDAK di-cache — harus selalu fresh (Bagian 18.1).
     * @returns {Promise<{ok, pesan, data: {pembayaran[]}}>}
     */
    async function getPembayaran() {
        return _get({ action: "getPembayaran" }, true);
    }

    /**
     * Upload bukti pembayaran.
     * @param {string} jenisPembayaran  - misal "DP" | "LUNAS"
     * @param {File}   file
     * @returns {Promise<{ok, pesan, data: {paymentId}}>}
     */
    async function uploadBuktiPembayaran(jenisPembayaran, file) {
        const maxBytes = (APP_CONFIG.maxUploadMB || 2) * 1024 * 1024;
        if (file.size > maxBytes) {
            return {
                ok: false,
                pesan: `Ukuran file melebihi batas ${APP_CONFIG.maxUploadMB} MB.`,
            };
        }

        const formData = new FormData();
        formData.append("action", "uploadBuktiPembayaran");
        formData.append("jenisPembayaran", jenisPembayaran);
        formData.append("file", file);

        return _postFormData(formData);
    }

    // -------------------------------------------------------------------------
    // ADMIN & PETUGAS
    // -------------------------------------------------------------------------

    /**
     * [ADMIN/PETUGAS] Ambil daftar semua pendaftar, opsional dengan filter + pagination.
     * @param {Object} filter - { status?, gelombang?, cari?, page?, pageSize? } — semua opsional
     * @returns {Promise<{ok, pesan, data: {pendaftar[], total, page, pageSize, totalPages}}>}
     */
    async function adminGetPendaftar(filter = {}) {
        return _get({ action: "adminGetPendaftar", ...filter }, true);
    }

    /**
     * [ADMIN/PETUGAS] Ambil detail satu pendaftar.
     * @param {string} noPendaftaran
     * @returns {Promise<{ok, pesan, data: {pendaftar, dokumen[], pembayaran[]}}>}
     */
    async function adminGetDetail(noPendaftaran) {
        return _get({ action: "adminGetDetail", noPendaftaran }, true);
    }

    /**
     * [PETUGAS] Verifikasi atau tolak dokumen.
     * @param {string} dokumenId
     * @param {string} statusBaru  - "Valid" | "Perlu Perbaikan"
     * @param {string} catatan     - wajib diisi jika ditolak
     * @returns {Promise<{ok, pesan}>}
     */
    async function adminVerifikasiDokumen(dokumenId, statusBaru, catatan = "") {
        return _post({
            action: "adminVerifikasiDokumen",
            dokumenId,
            statusBaru,
            catatan,
        }, true);
    }

    /**
     * [PETUGAS] Update status pendaftaran.
     * @param {string} noPendaftaran
     * @param {string} statusBaru
     * @param {string} catatan
     * @returns {Promise<{ok, pesan}>}
     */
    async function adminUpdateStatus(noPendaftaran, statusBaru, catatan = "") {
        return _post({
            action: "adminUpdateStatus",
            noPendaftaran,
            statusBaru,
            catatan,
        }, true);
    }

    /**
     * [PETUGAS] Konfirmasi atau tolak pembayaran.
     * @param {string} paymentId
     * @param {string} statusBaru  - "Dikonfirmasi" | "Ditolak"
     * @param {string} catatan
     * @returns {Promise<{ok, pesan}>}
     */
    async function adminKonfirmasiPembayaran(paymentId, statusBaru, catatan = "") {
        return _post({
            action: "adminKonfirmasiPembayaran",
            paymentId,
            statusBaru,
            catatan,
        }, true);
    }

    /**
     * [ADMIN] Update nilai di CONFIG sheet.
     * Otomatis membuang cache CONFIG client supaya halaman lain tidak
     * memakai nilai basi (Bagian 18.1 — CONFIG cache invalidation).
     * @param {string} key    - misal "STATUS_PENDAFTARAN_DIBUKA"
     * @param {string} value  - nilai baru
     * @returns {Promise<{ok, pesan}>}
     */
    async function adminUpdateConfig(key, value) {
        const res = await _post({ action: "adminUpdateConfig", key, value }, true);
        if (res.ok) {
            _cache.config = null; // paksa fetch ulang di panggilan getConfig() berikutnya
        }
        return res;
    }

    /**
     * Ambil daftar pengumuman aktif. Publik — tidak butuh token.
     * @returns {Promise<{ok, pesan, data: {pengumuman[]}}>}
     */
    async function getPengumuman() {
        return _get({ action: "getPengumuman" });
    }

    /**
     * [PETUGAS/ADMIN] Buat pengumuman baru, atau update kalau pengumumanId disertakan.
     * Untuk "hapus", kirim { pengumumanId, judul, aktif: "Tidak" }.
     * @param {Object} data - { pengumumanId?, judul, isi?, aktif? }
     * @returns {Promise<{ok, pesan, data?: {pengumumanId}}>}
     */
    async function adminSimpanPengumuman(data) {
        return _post({ action: "adminSimpanPengumuman", ...data }, true);
    }

    /**
     * [ADMIN] Reset PIN pendaftar.
     * @param {string} noPendaftaran
     * @param {string} pinBaru
     * @returns {Promise<{ok, pesan}>}
     */
    async function adminResetPIN(noPendaftaran, pinBaru) {
        return _post({ action: "adminResetPIN", noPendaftaran, pinBaru }, true);
    }

    // -------------------------------------------------------------------------
    // PRIVATE UTILITY
    // -------------------------------------------------------------------------

    /**
     * Generate UUID v4 sederhana (tidak butuh library eksternal).
     * Dipakai untuk SUBMISSION_ID pada submitPendaftaran.
     * @returns {string}
     */
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
        // Auth
        login,
        loginSekolah,
        loginGooglePendaftar,
        loginGoogleSekolah,
        logout,
        verifyToken,
        isSessionValid,

        // Status gerbang & self-check
        cekStatus,
        selfCheck,

        // Data referensi (cache client)
        getConfig,
        getWilayahLokal,
        getReferensiSekolah,
        clearCache,

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

        // Pengumuman
        getPengumuman,
        adminSimpanPengumuman,

        // Admin & Petugas
        adminGetPendaftar,
        adminGetDetail,
        adminVerifikasiDokumen,
        adminUpdateStatus,
        adminKonfirmasiPembayaran,
        adminUpdateConfig,
        adminResetPIN,
    };

})();
