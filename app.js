// app.js
(() => {
  const $ = (sel) => document.querySelector(sel);

  // ============ Force "go to absolute top" for logo clicks ============
  function initTopLinks(){
    document.querySelectorAll(".js-top").forEach(a => {
      a.addEventListener("click", (e) => {
        // keep hash clean but ensure true top
        e.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        history.replaceState(null, "", "#pageTop");
      });
    });
  }

  // ============ Header menu (MOBILE SAFE) ============
  function initHeaderMenu(){
    const menu   = $("#hmenu");
    const btn    = $("#hmenuBtn");
    const panel  = $("#hmenuPanel");
    const header = document.querySelector(".header");
    if (!menu || !btn || !panel) return;

    function syncMenuTop(){
      const h = header?.getBoundingClientRect?.().height || 88;
      document.documentElement.style.setProperty("--menuTop", `${Math.round(h)}px`);
    }

    function open(){
      syncMenuTop();
      menu.classList.add("is-open");
      btn.setAttribute("aria-expanded","true");
      document.body.classList.add("menu-open");
    }

    function close(){
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded","false");
      document.body.classList.remove("menu-open");
    }

    function toggle(){
      menu.classList.contains("is-open") ? close() : open();
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    panel.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = e.target.closest("a");
      if (a) close();
    });

    panel.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    panel.addEventListener("touchmove",  (e) => e.stopPropagation(), { passive: true });

    document.addEventListener("click", () => close());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", () => {
      if (menu.classList.contains("is-open")) syncMenuTop();
    });
    window.addEventListener("orientationchange", () => {
      if (menu.classList.contains("is-open")) setTimeout(syncMenuTop, 80);
    });
  }

  // Fetch config
  async function loadConfig() {
    const res = await fetch("./config/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load site.json (${res.status})`);
    return await res.json();
  }

  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  async function decodeImages(rootEl){
    const imgs = Array.from(rootEl.querySelectorAll("img"));
    const tasks = imgs.map(img => {
      if (!img.complete) {
        return new Promise(res => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        });
      }
      if (img.decode) return img.decode().catch(() => {});
      return Promise.resolve();
    });
    await Promise.all(tasks);
  }

  // ============ Continuous Models Marquee (RTL SAFE) ============
  function initModelsMarquee(items) {
    const track = $("#cartrack");
    if (!track) return;

    if (track._rafId) { cancelAnimationFrame(track._rafId); track._rafId = null; }
    if (track._onResize) { window.removeEventListener("resize", track._onResize); track._onResize = null; }
    if (track._onVis) { document.removeEventListener("visibilitychange", track._onVis); track._onVis = null; }
    if (track._onEnter) { track.removeEventListener("mouseenter", track._onEnter); track._onEnter = null; }
    if (track._onLeave) { track.removeEventListener("mouseleave", track._onLeave); track._onLeave = null; }
    if (track._onTouchStart) { track.removeEventListener("touchstart", track._onTouchStart); track._onTouchStart = null; }
    if (track._onTouchEnd) { track.removeEventListener("touchend", track._onTouchEnd); track._onTouchEnd = null; }

    track.innerHTML = "";

    const wrap = track.parentElement;
    if (!wrap) return;

    wrap.style.direction = "ltr";
    track.style.direction = "ltr";
    wrap.style.overflow = "hidden";

    const buildOneSet = () => {
      const frag = document.createDocumentFragment();

      items.forEach((it, idx) => {
        const slide = document.createElement("div");
        slide.className = "slide";

        const img = document.createElement("img");
        img.src = it.img;
        img.alt = it.caption || `model ${idx + 1}`;

        const cap = document.createElement("div");
        cap.className = "caption";
        cap.textContent = it.caption || "";

        slide.appendChild(img);
        slide.appendChild(cap);
        frag.appendChild(slide);
      });

      return frag;
    };

    let singleSetWidth = 0;

    const rebuild = async () => {
      track.innerHTML = "";
      track.style.transform = "translateX(0px)";
      singleSetWidth = 0;

      if (!items || !items.length) return;

      const set1 = document.createElement("div");
      set1.style.display = "flex";
      set1.style.gap = "14px";
      set1.appendChild(buildOneSet());
      track.appendChild(set1);

      await nextFrame();
      await decodeImages(track);
      await nextFrame();

      singleSetWidth = Math.ceil(set1.getBoundingClientRect().width);

      const set2 = set1.cloneNode(true);
      track.appendChild(set2);

      await nextFrame();
    };

    let x = 0;
    let last = performance.now();

    const isMobile = matchMedia("(max-width: 560px)").matches;
    const SPEED = isMobile ? 85 : 120;
    const DIR = -1;

    let paused = false;

    function tick(now){
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!singleSetWidth || singleSetWidth <= 0) {
        track._rafId = requestAnimationFrame(tick);
        return;
      }

      if (!paused) {
        x += SPEED * dt;
        if (x >= singleSetWidth) x -= singleSetWidth;
        track.style.transform = `translateX(${DIR * x}px)`;
      }

      track._rafId = requestAnimationFrame(tick);
    }

    (async () => {
      await rebuild();
      x = 0;
      last = performance.now();
      track._rafId = requestAnimationFrame(tick);
    })();

    track._onEnter = () => { paused = true; };
    track._onLeave = () => { paused = false; last = performance.now(); };
    track.addEventListener("mouseenter", track._onEnter);
    track.addEventListener("mouseleave", track._onLeave);

    track._onTouchStart = () => { paused = true; };
    track._onTouchEnd = () => { paused = false; last = performance.now(); };
    track.addEventListener("touchstart", track._onTouchStart, { passive: true });
    track.addEventListener("touchend", track._onTouchEnd, { passive: true });

    track._onResize = async () => {
      x = 0;
      last = performance.now();
      await rebuild();
    };
    window.addEventListener("resize", track._onResize);

    track._onVis = () => {
      if (document.hidden && track._rafId) {
        cancelAnimationFrame(track._rafId);
        track._rafId = null;
      }
      if (!document.hidden && !track._rafId) {
        last = performance.now();
        track._rafId = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", track._onVis);
  }

  // FAQ
  function initFAQ(faq) {
    const wrap = $("#faqList");
    if (!wrap) return;
    wrap.innerHTML = "";

    faq.forEach((item) => {
      const box = document.createElement("div");
      box.className = "faqItem";

      const q = document.createElement("button");
      q.className = "faqQ";
      q.type = "button";
      q.innerHTML = `<span>${item.q}</span><span class="faqIcon">+</span>`;

      const a = document.createElement("div");
      a.className = "faqA";
      a.textContent = item.a;

      q.addEventListener("click", () => {
        box.classList.toggle("is-open");
        const icon = q.querySelector(".faqIcon");
        if (icon) icon.textContent = box.classList.contains("is-open") ? "−" : "+";
      });

      box.appendChild(q);
      box.appendChild(a);
      wrap.appendChild(box);
    });
  }

  function normalizeUrl(u){
    if (!u) return "";
    return String(u).trim();
  }

  function setLinks(cfg) {
    const wa = normalizeUrl(cfg?.links?.whatsapp) || "https://wa.me/201271028216";
    ["#waTop", "#waFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", wa);
    });

    const fb = normalizeUrl(cfg?.links?.facebook) || "https://www.facebook.com/";
    ["#fbTop", "#fbFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", fb);
    });

    const form = normalizeUrl(cfg?.links?.requestForm) || "https://forms.gle/GsTXZGXXrcypanPd7";
    ["#ctaHero", "#ctaProblem", "#ctaFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", form);
    });

    const report = normalizeUrl(cfg?.links?.reportPdf) || "";
    const rep = $("#ctaReport");
    if (rep) rep.setAttribute("href", report);
  }

  function renderSections(cfg, lang) {
    const heroBg = $("#heroBg");
    if (heroBg && cfg?.images?.heroBg) {
      heroBg.style.backgroundImage = `url("${cfg.images.heroBg}")`;
    }

    const problemImg = $("#problemImg");
    if (problemImg && cfg?.images?.problem) {
      problemImg.src = cfg.images.problem;
      problemImg.alt = (lang === "en")
        ? "Why is finding the right apartment in Madinaty hard?"
        : "لماذا صعب العثور على الشقة المناسبة في مدينتي؟";
    }

    const problemBox = $("#problemBullets");
    if (problemBox) {
      problemBox.innerHTML = "";
      (cfg?.content?.[lang]?.problemBullets || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        problemBox.appendChild(li);
      });
    }

    const whyImg = $("#whyImg");
    if (whyImg && cfg?.images?.why) {
      whyImg.src = cfg.images.why;
      whyImg.alt = (lang === "en") ? "Why Smart Select?" : "لماذا Smart Select؟";
    }

    const whyBox = $("#whyBullets");
    if (whyBox) {
      whyBox.innerHTML = "";
      (cfg?.content?.[lang]?.whyBullets || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        whyBox.appendChild(li);
      });
    }

    initModelsMarquee(cfg?.models?.items || []);
    initFAQ(cfg?.content?.[lang]?.faq || []);

    const copy = $("#footerCopy");
    if (copy) {
      const year = new Date().getFullYear();
      copy.textContent = `© ${year} Smart Select. All rights reserved.`;
    }

    const note = $("#footerNote");
    if (note) {
      note.textContent = cfg?.i18n?.[lang]?.footer_note || "";
    }
  }

  // ✅ Detect lang from page (index = ar, en.html = en)
  function detectLang(){
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
    return "ar";
  }

  function boot(cfg){
    setLinks(cfg);
    initTopLinks();
    initHeaderMenu();
    const lang = detectLang();
    renderSections(cfg, lang);
  }

  // Boot
  loadConfig()
    .then(cfg => boot(cfg))
    .catch(err => {
      console.error(err);
      const hero = document.querySelector(".hero__subtitle");
      if (hero) hero.textContent = "حدث خطأ في تحميل الإعدادات (site.json). تأكد من وجود الملف في config/site.json.";
    });
})();
