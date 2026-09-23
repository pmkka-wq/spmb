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
        perisai: `<svg ${_svgAtribut}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z"></path></svg>`,
        petir: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
        spinner: `<svg ${_svgAtribut} class="ikon-spin"><path d="M21 12a9 9 0 1 1-9-9"></path></svg>`,
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

    function linkWA(nomor, nama, pesanTemplate) {
        const teks = encodeURIComponent(pesanTemplate || ("Halo " + (nama || "") + ", saya mau bertanya seputar SPMB."));
        return "https://wa.me/" + String(nomor || "").replace(/\D/g, "") + "?text=" + teks;
    }

    return { ikon, toast, escapeHtml, formatRupiah, csvKeArray, formatTanggal, linkWA };
})();
