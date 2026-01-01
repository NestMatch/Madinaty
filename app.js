// app.js
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ================== 1) Fix FINAL ya only: (ي at end of word) -> ى ==================
  const YA = "\u064A";            // ي
  const ALEF_MAQSURA = "\u0649";  // ى

  // ي تتحول لـ ى فقط لو بعدها: نهاية النص أو مسافة أو ترقيم/أقواس...
  const FINAL_YA_RE =
    /ي(?=$|[\s\u00A0\u2000-\u200A\u202F\u205F\u3000\)\]\}\>»"'\u060C\u061B\u061F\.,!?:;…])/g;

  function shouldSkipNode(node){
    if (!node) return true;

    // skip if inside these tags
    const p = node.parentElement;
    if (!p) return false;

    const tag = p.tagName?.toLowerCase?.() || "";
    if (["script","style","noscript","textarea","input","select","option","code","pre"].includes(tag)) return true;

    // skip editable areas
    if (p.isContentEditable) return true;

    // skip elements explicitly opting out
    if (p.closest?.("[data-no-ya-fix]")) return true;

    return false;
  }

  function replaceFinalYaInTextNode(tn){
    if (!tn || !tn.nodeValue) return 0;
    if (tn.nodeValue.indexOf(YA) === -1) return 0;
    if (shouldSkipNode(tn)) return 0;

    const before = tn.nodeValue;
    const after = before.replace(FINAL_YA_RE, ALEF_MAQSURA);

    if (after !== before) {
      tn.nodeValue = after;
      return 1;
    }
    return 0;
  }

  function fixYaDots(root = document.body){
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let changed = 0;

    while (walker.nextNode()) {
      changed += replaceFinalYaInTextNode(walker.currentNode);
    }

    return changed;
  }

  function observeYaFix(root = document.body){
    if (!root) return;

    // avoid double observers
    if (root._yaObserver) {
      try { root._yaObserver.disconnect(); } catch(e){}
      root._yaObserver = null;
    }

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // text changes
        if (m.type === "characterData" && m.target) {
          replaceFinalYaInTextNode(m.target);
          continue;
        }
        // new nodes
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) {
              replaceFinalYaInTextNode(n);
            } else if (n.nodeType === Node.ELEMENT_NODE) {
              fixYaDots(n);
            }
          });
        }
      }
    });

    obs.observe(root, {
      subtree: true,
      childList: true,
      characterData: true
    });

    root._yaObserver = obs;
  }

  // ============ Force "go to absolute top" for logo clicks ============
  function initTopLinks(){
    $$(".js-top").forEach(a => {
      a.addEventListener("click", (e) => {
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
    const header = $(".header");
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

    // cleanup previous listeners/raf
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

    // Email (if exists in DOM)
    const email = normalizeUrl(cfg?.links?.email) || "";
    ["#emailTop", "#emailFooter"].forEach(id => {
      const el = $(id);
      if (!el) return;

      if (!email) {
        el.style.display = "none";
        return;
      }

      el.style.display = "";
      el.setAttribute("href", `mailto:${email}`);
      el.textContent = email;
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

  // i18n injection
  function applyI18n(cfg, lang){
    const t = cfg?.i18n?.[lang];
    if (!t) return;

    const panel = $("#hmenuPanel");
    if (panel) {
      const aProblem = panel.querySelector('a[href="#problem"]');
      const aWhy     = panel.querySelector('a[href="#why"]');
      const aModels  = panel.querySelector('a[href="#models"]');
      const aFaq     = panel.querySelector('a[href="#faq"]');

      if (aProblem && t.nav_problem) aProblem.textContent = t.nav_problem;
      if (aWhy && t.nav_why)         aWhy.textContent = t.nav_why;
      if (aModels && t.nav_models)   aModels.textContent = t.nav_models;
      if (aFaq && t.nav_faq)         aFaq.textContent = t.nav_faq;
    }

    const heroTitle = $(".hero__title");
    const heroSub   = $(".hero__subtitle");
    if (heroTitle && t.hero_title) heroTitle.textContent = t.hero_title;
    if (heroSub && t.hero_subtitle) heroSub.textContent = t.hero_subtitle;

    const ctaHero = $("#ctaHero");
    const ctaFooter = $("#ctaFooter");
    const ctaReport = $("#ctaReport");
    if (ctaHero && t.cta_request) ctaHero.textContent = t.cta_request;
    if (ctaFooter && t.cta_request) ctaFooter.textContent = t.cta_request;
    if (ctaReport && t.cta_sample) ctaReport.textContent = t.cta_sample;

    const hProblem = $('#problem .h2');
    const hWhy     = $('#why .h2');
    const hModels  = $('#models .h2');
    const hFaq     = $('#faq .h2');

    if (hProblem && t.problem_title) hProblem.textContent = t.problem_title;
    if (hWhy && t.why_title)         hWhy.textContent = t.why_title;
    if (hModels && t.models_title)   hModels.textContent = t.models_title;
    if (hFaq && t.faq_title)         hFaq.textContent = t.faq_title;

    const note = $("#footerNote");
    if (note && t.footer_note) note.textContent = t.footer_note;
  }

  function renderSections(cfg, lang) {
    applyI18n(cfg, lang);

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
      whyImg.alt = (lang === "en") ? "Why Nest Match?" : "لماذا Nest Match؟";
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
      copy.textContent = `© ${year} Nest Match. All rights reserved.`;
    }

    // ✅ after all dynamic text is injected, fix final-ya once
    fixYaDots(document.body);
  }

  function detectLang(){
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
    return "ar";
  }

  function boot(cfg){
    // ✅ start observer early (covers any late injections)
    observeYaFix(document.body);

    setLinks(cfg);
    initTopLinks();
    initHeaderMenu();
    const lang = detectLang();
    renderSections(cfg, lang);

    // ✅ safety: run again after load
    window.addEventListener("load", () => fixYaDots(document.body), { once: true });
  }

  // Boot
  loadConfig()
    .then(cfg => boot(cfg))
    .catch(err => {
      console.error(err);
      const hero = document.querySelector(".hero__subtitle");
      if (hero) hero.textContent = "حدث خطأ في تحميل الإعدادات (site.json). تأكد من وجود الملف في config/site.json.";
      // still try to apply final-ya fix
      observeYaFix(document.body);
      fixYaDots(document.body);
    });
})();
