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
    /**
     * Ganti {placeholder} di template. Case-INSENSITIVE ({kelas_peminatan}
     * dan {KELAS_PEMINATAN} dua-duanya cocok) karena orang yang mengisi
     * template di CONFIG sering pakai gaya huruf besar ala nama kolom
     * database tanpa sadar placeholder-nya sebenarnya huruf kecil.
     */
    function isiTemplate(template, data) {
        let hasil = String(template || "");
        Object.keys(data || {}).forEach(function (k) {
            const re = new RegExp("\\{" + k + "\\}", "gi");
            hasil = hasil.replace(re, data[k] == null ? "" : String(data[k]));
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
     * Uraikan teks rekening dari CONFIG (REKENING_1/2).
     * FORMAT RESMI: "nama_bank,no_rek,atas_nama"
     *   contoh: BANK MANDIRI,111222333555,Sinta Malihah
     * -> { bank:"BANK MANDIRI", nomor:"111222333555", pemilik:"Sinta Malihah" }
     * Yang disalin ke clipboard HANYA `nomor`. Atas nama boleh mengandung
     * koma (semua bagian setelah no_rek digabung kembali).
     * Fallback (kalau admin salah format / tidak ada koma): cari deretan
     * digit terpanjang sebagai nomor, supaya tombol salin tetap berguna.
     */
    function uraikanRekening(teks) {
        const s = String(teks || "").trim();
        const bagian = s.split(",").map(function (x) { return x.trim(); });
        if (bagian.length >= 3 && /\d{5,}/.test(bagian[1].replace(/[\s-]/g, ""))) {
            return { bank: bagian[0], nomor: bagian[1].replace(/[\s-]/g, ""), pemilik: bagian.slice(2).join(", ") };
        }
        const kandidat = s.match(/\d[\d\-\s]{4,}\d/g) || [];
        if (!kandidat.length) return { bank: "", nomor: s, pemilik: "" };
        const terpanjang = kandidat.reduce(function (a, b) { return b.replace(/\D/g, "").length > a.replace(/\D/g, "").length ? b : a; });
        const i = s.indexOf(terpanjang);
        return {
            bank: s.slice(0, i).replace(/[,\s]+$/, "").trim(),
            nomor: terpanjang.replace(/[\s-]/g, ""),
            pemilik: s.slice(i + terpanjang.length).replace(/^[\s,-]*(a\.?n\.?)?[\s:.-]*/i, "").trim(),
        };
    }

    /**
     * Blok HTML satu rekening, untuk latar GELAP (kartu hijau tua):
     *   Bank [nama_bank]
     *   Nomor rekening [no_rek] [ikon salin]
     *   Atas nama [atas_nama]
     * Tombol salin memakai atribut data-salin-rekening (listener dipasang
     * di halaman pemanggil) dan hanya menyalin no_rek.
     */
    function htmlRekening(teks) {
        const r = uraikanRekening(teks);
        const baris = function (label, isi) {
            return '<div style="display:flex; gap:8px; font-size:0.78rem; line-height:1.5;"><span style="min-width:96px; color:#cbd5c8;">' + label + '</span><span style="font-weight:800; color:#fff;">' + escapeHtml(isi) + '</span></div>';
        };
        return '<div style="margin-top:8px; padding:10px 12px; background:rgba(255,255,255,0.08); border-radius:10px;">'
            + (r.bank ? baris("Bank", r.bank) : "")
            + '<div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; line-height:1.5;"><span style="min-width:96px; color:#cbd5c8;">Nomor rekening</span><span style="font-weight:800; color:#fff; letter-spacing:0.02em;">' + escapeHtml(r.nomor) + '</span>'
            + '<button type="button" data-salin-rekening="' + escapeHtml(r.nomor) + '" aria-label="Salin nomor rekening" style="flex-shrink:0; padding:4px 7px; background:rgba(255,255,255,0.15); border-color:rgba(255,255,255,0.25); color:#fff; border-radius:8px; line-height:1;">' + ikon("salin") + '</button></div>'
            + (r.pemilik ? baris("Atas nama", r.pemilik) : "")
            + '</div>';
    }

    /** Alamat tersimpan memakai ";" sebagai pemisah (Master Context 6.7); ke pengguna ditampilkan dengan koma. */
    function tampilAlamat(teks) {
        return String(teks || "").split(";").map(function (x) { return x.trim(); }).filter(Boolean).join(", ");
    }

    /**
     * Buka tab baru berisi halaman cetak sederhana lalu panggil print()
     * (pengguna bisa pilih "Save as PDF" di dialog cetak browser). Sengaja
     * TIDAK pakai library PDF (jsPDF dkk) supaya aplikasi tetap ringan —
     * hasil cetak tetap rapi karena CSS @media print disiapkan khusus.
     * @param {string} judul - jadi <title> tab & nama file saat disimpan
     * @param {string} htmlIsi - HTML konten (tanpa <html>/<body>)
     */
    /**
     * @param {string} judul - <title> tab & nama file
     * @param {string} htmlIsi - konten utama (tabel dkk)
     * @param {Object} [kop] - { judulDok, subJudul1, subJudul2 } untuk kop
     *   resmi di atas (mis. "BUKTI PENDAFTARAN" / "SPMB TA 2026/2027" /
     *   "SMP MUHAMMADIYAH 2 CILACAP"). Opsional — kalau tidak diisi, tidak
     *   ada kop, langsung konten.
     */
    function cetakHalaman(judul, htmlIsi, kop) {
        const w = window.open("", "_blank");
        if (!w) { toast("Popup diblokir browser — izinkan popup untuk mencetak.", "error"); return; }
        const htmlKop = kop ? `
            <div class="kop">
                <div class="kop-judul">${escapeHtml(kop.judulDok || "")}</div>
                ${kop.subJudul1 ? `<div class="kop-sub">${escapeHtml(kop.subJudul1)}</div>` : ""}
                ${kop.subJudul2 ? `<div class="kop-sub">${escapeHtml(kop.subJudul2)}</div>` : ""}
            </div>` : "";
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(judul)}</title>
            <style>
                @page { size: A4 portrait; margin: 18mm 16mm; }
                * { box-sizing: border-box; }
                body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; color: #1a2e22; padding: 28px; max-width: 700px; margin: 0 auto; }
                .kop { text-align: center; border-bottom: 3px solid #1d6e4a; padding-bottom: 14px; margin-bottom: 22px; }
                .kop-judul { font-size: 1.15rem; font-weight: 800; letter-spacing: 0.04em; color: #1d6e4a; }
                .kop-sub { font-size: 0.85rem; color: #45564c; margin-top: 2px; }
                h1 { font-size: 1.35rem; margin: 0 0 4px; text-align: center; }
                .sub { color: #6b7c72; font-size: 0.85rem; margin-bottom: 20px; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #dbe6df; border-radius: 6px; overflow: hidden; }
                td { padding: 10px 14px; font-size: 0.92rem; border-bottom: 1px solid #eef3f0; }
                tr:nth-child(even) td { background: #f4f8fd; } /* zebra biru sangat muda, hampir putih */
                tr:last-child td { border-bottom: none; }
                td:first-child { color: #51645a; width: 42%; font-weight: 600; }
                td:last-child { font-weight: 700; color: #16201a; }
                .cap { margin-top: 28px; font-size: 0.72rem; color: #8a9790; text-align: center; }
                @media print { body { padding: 0; } }
            </style>
            </head><body>${htmlKop}${htmlIsi}
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

    return { ikon, toast, escapeHtml, formatRupiah, csvKeArray, formatTanggal, linkWA, isiTemplate, bukaFile, cetakHalaman, salin, uraikanRekening, htmlRekening, tampilAlamat, pasangToggleSandi };
})();
