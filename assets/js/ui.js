/**
 * assets/js/ui.js
 * SPMB Mudacil — helper UI bersama (dimuat SETELAH api.js).
 * Sengaja tidak pakai Font Awesome / library ikon eksternal — semua ikon
 * inline SVG kecil (nol request tambahan, konsisten dgn Bagian 18 Master
 * Context: minimalkan beban jaringan).
 */

const UI = (() => {

    // -------------------------------------------------------------------
    // IKON (inline SVG, stroke = currentColor supaya ikut warna teks)
    // -------------------------------------------------------------------
    const _svgAtribut = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
    const IKON = {
        cek: `<svg ${_svgAtribut}><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        info: `<svg ${_svgAtribut}><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        panah: `<svg ${_svgAtribut}><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
        panahKiri: `<svg ${_svgAtribut}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
        wa: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1-.2.2-.4.2-.6.1-.9-.4-1.7-1-2.4-1.7-.6-.6-1.1-1.3-1.5-2-.1-.2 0-.4.1-.6.2-.2.4-.5.6-.7.2-.2.2-.4.1-.6-.1-.3-.9-2.1-1.1-2.4-.2-.3-.4-.3-.6-.3h-.5c-.2 0-.5.1-.7.3-.7.7-1.1 1.6-1.1 2.6 0 2.5 2.1 4.9 2.4 5.2.3.3 2.8 4.2 6.7 5.7 3.9 1.5 3.9 1 4.6.9.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
        kunci: `<svg ${_svgAtribut}><rect x="4" y="10" width="16" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>`,
        unggah: `<svg ${_svgAtribut}><path d="M12 16V4"></path><polyline points="7 9 12 4 17 9"></polyline><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></svg>`,
        salin: `<svg ${_svgAtribut}><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M4 15V5a2 2 0 0 1 2-2h10"></path></svg>`,
        keluar: `<svg ${_svgAtribut}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
        jam: `<svg ${_svgAtribut}><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>`,
        lonceng: `<svg ${_svgAtribut}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
        perisai: `<svg ${_svgAtribut}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z"></path></svg>`,
        petir: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
        spinner: `<svg ${_svgAtribut} class="ikon-spin"><path d="M21 12a9 9 0 1 1-9-9"></path></svg>`,
        mata: `<svg ${_svgAtribut}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        mataCoret: `<svg ${_svgAtribut}><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
    };

    function ikon(nama) { return IKON[nama] || ""; }

    // -------------------------------------------------------------------
    // TOAST
    // -------------------------------------------------------------------
    let _toastTimer = null;
    function toast(pesan, jenis) {
        let el = document.getElementById("uiToast");
        if (!el) {
            el = document.createElement("div");
            el.id = "uiToast";
            el.className = "toast";
            document.body.appendChild(el);
        }
        el.style.borderColor = jenis === "error" ? "var(--merah)" : "var(--hijau-600)";
        el.innerHTML = ikon(jenis === "error" ? "info" : "cek") + "<span>" + escapeHtml(pesan) + "</span>";
        el.style.display = "flex";
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { el.style.display = "none"; }, 3500);
    }

    // -------------------------------------------------------------------
    // FORMAT & UTIL KECIL
    // -------------------------------------------------------------------
    function escapeHtml(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function formatRupiah(angka) {
        const n = Number(angka || 0);
        if (isNaN(n)) return String(angka || "0");
        return "Rp " + n.toLocaleString("id-ID");
    }

    function csvKeArray(csv) {
        return String(csv || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function formatTanggal(nilai) {
        if (!nilai) return "-";
        try {
            const d = new Date(nilai);
            if (isNaN(d.getTime())) return String(nilai);
            return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        } catch (e) { return String(nilai); }
    }

    /**
     * Bangun link wa.me. Nomor dinormalisasi ke format internasional:
     * "08xxxx" -> "628xxxx" (wa.me TIDAK jalan kalau masih pakai 0 di
     * depan) — penting terutama untuk nomor PENDAFTAR yang selalu
     * tersimpan format lokal "08...", beda dgn nomor admin di CONFIG yang
     * biasanya sudah diisi manual dalam format 62.
     */
    function linkWA(nomor, nama, pesanTemplate) {
        const teks = encodeURIComponent(pesanTemplate || ("Halo " + (nama || "") + ", saya mau bertanya seputar SPMB."));
        let digit = String(nomor || "").replace(/\D/g, "");
        if (digit.startsWith("0")) digit = "62" + digit.slice(1);
        else if (!digit.startsWith("62")) digit = "62" + digit;
        return "https://wa.me/" + digit + "?text=" + teks;
    }

    /**
     * Ganti placeholder {nama} di template teks dengan nilai dari `data`.
     * Dipakai untuk template pesan WA yang bisa diatur lewat CONFIG.
     * @param {string} template
     * @param {Object} data - { key: value }
     */
    function isiTemplate(template, data) {
        let hasil = String(template || "");
        Object.keys(data || {}).forEach(function (k) {
            hasil = hasil.split("{" + k + "}").join(data[k] == null ? "" : String(data[k]));
        });
        return hasil;
    }

    /**
     * Buka file dokumen/bukti di tab baru lewat server (API.getFile).
     * Tab dibuka SINKRON dulu (di dalam klik) supaya tidak diblokir popup
     * blocker, lalu diarahkan ke blob setelah file selesai diambil.
     * @returns {Promise<boolean>} true jika berhasil dibuka
     */
    async function bukaFile(jenis, id) {
        const tab = window.open("", "_blank");
        if (tab) tab.document.write("<p style='font-family:sans-serif'>Memuat berkas…</p>");
        try {
            const res = await API.getFile(jenis, id);
            if (!res.ok) throw new Error(res.pesan || "Gagal membuka berkas.");
            const bin = atob(res.data.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const url = URL.createObjectURL(new Blob([bytes], { type: res.data.mime }));
            if (tab) tab.location.href = url; else window.location.href = url;
            return true;
        } catch (err) {
            if (tab) tab.close();
            toast(err.message || "Gagal membuka berkas.", "error");
            return false;
        }
    }

    /**
     * Salin teks ke clipboard (dgn fallback untuk browser/WebView lama
     * yang tidak dukung navigator.clipboard), lalu tampilkan toast.
     * Dipakai untuk tombol salin rekening, No. Pendaftaran, dll.
     * @param {string} teks
     * @param {string} [labelToast] - teks di toast, default "Tersalin."
     */
    async function salin(teks, labelToast) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(teks);
            } else {
                const ta = document.createElement("textarea");
                ta.value = teks;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus(); ta.select();
                document.execCommand("copy");
                ta.remove();
            }
            toast(labelToast || "Tersalin.");
        } catch (err) {
            toast("Gagal menyalin — salin manual ya.", "error");
        }
    }

    /**
     * Pecah "BSI 7123456789 a.n. Nama" jadi { bank, nomor, pemilik } kalau
     * polanya cocok; kalau tidak, nomor fallback ke seluruh teks (tetap
     * bisa disalin, cuma label banknya kosong).
     */
    function uraikanRekening(teks) {
        const s = String(teks || "");
        const m = s.match(/^(\S+)\s+([\d\-.\s]{6,})\s*(?:a\.?n\.?\s*(.+))?$/i);
        if (!m) return { bank: "", nomor: s, pemilik: "" };
        return { bank: m[1], nomor: m[2].trim(), pemilik: (m[3] || "").trim() };
    }

    /**
     * Buka tab baru berisi halaman cetak sederhana lalu panggil print()
     * (pengguna bisa pilih "Save as PDF" di dialog cetak browser). Sengaja
     * TIDAK pakai library PDF (jsPDF dkk) supaya aplikasi tetap ringan —
     * hasil cetak tetap rapi karena CSS @media print disiapkan khusus.
     * @param {string} judul - jadi <title> tab & nama file saat disimpan
     * @param {string} htmlIsi - HTML konten (tanpa <html>/<body>)
     */
    function cetakHalaman(judul, htmlIsi) {
        const w = window.open("", "_blank");
        if (!w) { toast("Popup diblokir browser — izinkan popup untuk mencetak.", "error"); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(judul)}</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: -apple-system, system-ui, sans-serif; color: #1a2e22; padding: 32px; max-width: 700px; margin: 0 auto; }
                h1 { font-size: 1.3rem; margin: 0 0 4px; }
                .sub { color: #6b7c72; font-size: 0.85rem; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                td { padding: 8px 4px; border-bottom: 1px solid #e5e9e6; font-size: 0.92rem; }
                td:first-child { color: #6b7c72; width: 45%; }
                td:last-child { font-weight: 700; }
                .cap { margin-top: 28px; font-size: 0.75rem; color: #6b7c72; text-align: center; }
                @media print { body { padding: 0; } }
            </style>
            </head><body>${htmlIsi}
            <div class="cap">Dicetak dari SPMB — ${new Date().toLocaleString("id-ID")}</div>
            <script>window.onload = function () { window.print(); };<\/script>
            </body></html>`);
        w.document.close();
    }

    /**
     * Bungkus SEMUA field password di halaman dengan tombol mata
     * tampilkan/sembunyikan. Panggil sekali setelah field password
     * dirender ke DOM. Tidak butuh markup tambahan di HTML.
     */
    function pasangToggleSandi() {
        document.querySelectorAll('input[type="password"]').forEach(function (inp) {
            if (inp.dataset.toggleTerpasang) return;
            inp.dataset.toggleTerpasang = "1";
            const bungkus = document.createElement("div");
            bungkus.style.position = "relative";
            inp.parentNode.insertBefore(bungkus, inp);
            bungkus.appendChild(inp);
            inp.style.paddingRight = "38px";

            const tombol = document.createElement("button");
            tombol.type = "button";
            tombol.innerHTML = ikon("mata");
            tombol.style.cssText = "position:absolute; right:4px; top:50%; transform:translateY(-50%); border:none; background:none; padding:6px; color:var(--tinta-samar);";
            bungkus.appendChild(tombol);

            tombol.addEventListener("click", function () {
                const tampil = inp.type === "text";
                inp.type = tampil ? "password" : "text";
                tombol.innerHTML = ikon(tampil ? "mata" : "mataCoret");
            });
        });
    }

    return { ikon, toast, escapeHtml, formatRupiah, csvKeArray, formatTanggal, linkWA, isiTemplate, bukaFile, cetakHalaman, salin, uraikanRekening, pasangToggleSandi };
})();
