(() => {
  const root = document.documentElement;
  const storageKey = "energynotes-theme";

  try {
    const savedTheme = window.localStorage.getItem(storageKey);
    if (savedTheme === "light") root.dataset.theme = "light";
  } catch (_) {
    // The page remains usable when storage is unavailable.
  }

  root.classList.remove("no-js");
  root.classList.add("js");

  function syncThemeControls() {
    const light = root.dataset.theme === "light";
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", light ? "#f4f0eb" : "#0c0715");
    document.querySelectorAll("input[data-theme-toggle]").forEach((input) => {
      input.checked = !light;
      input.setAttribute("aria-label", light ? "فعال‌کردن حالت شب" : "فعال‌کردن حالت روز");
      const wrapper = input.closest(".switch");
      if (wrapper) wrapper.setAttribute("title", light ? "فعال‌کردن حالت شب" : "فعال‌کردن حالت روز");
      const label = wrapper ? wrapper.querySelector("[data-theme-label]") : null;
      if (label) label.textContent = light ? "حالت روز" : "حالت شب";
    });
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("fa")
      .replace(/[يى]/g, "ی")
      .replace(/[ك]/g, "ک")
      .replace(/[َُِّْـ]/g, "")
      .replace(/[\u200c\s]+/g, " ")
      .trim();
  }

  function faDigits(value) {
    return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function renderSearchResults(items, query, results, status) {
    const normalizedQuery = normalize(query);
    results.replaceChildren();
    if (!normalizedQuery) {
      status.textContent = "برای شروع یک عبارت وارد کن.";
      return;
    }
    const terms = normalizedQuery.split(" ").filter(Boolean);
    const matches = items
      .map((item) => {
        const haystack = normalize(`${item.title} ${item.summary} ${item.text}`);
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? (normalize(item.title).includes(term) ? 3 : 1) : 0), 0);
        return { item, score };
      })
      .filter((entry) => entry.score === terms.length || entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "fa"));

    status.textContent = matches.length ? `${faDigits(matches.length)} نتیجه پیدا شد.` : "نتیجه‌ای برای این عبارت پیدا نشد.";
    matches.forEach(({ item }) => {
      const link = document.createElement("a");
      link.className = "search-result";
      link.href = item.href;
      const meta = document.createElement("span");
      meta.className = "search-result__meta";
      meta.textContent = `${item.topic} · ${faDigits(item.reading_minutes)} دقیقه مطالعه`;
      const title = document.createElement("h2");
      title.textContent = item.title;
      const summary = document.createElement("p");
      summary.textContent = item.summary;
      link.append(meta, title, summary);
      results.append(link);
    });
  }

  function setupSearch() {
    const page = document.querySelector("[data-search-page]");
    if (!page) return;
    const form = page.querySelector("[data-search-form]");
    const input = page.querySelector("[data-search-input]");
    const results = page.querySelector("[data-search-results]");
    const status = page.querySelector("[data-search-status]");
    if (!form || !input || !results || !status) return;
    let items = [];
    fetch(page.dataset.searchIndex)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("search index unavailable")))
      .then((data) => {
        items = Array.isArray(data) ? data : [];
        const query = new URLSearchParams(window.location.search).get("q") || "";
        input.value = query;
        renderSearchResults(items, query, results, status);
      })
      .catch(() => { status.textContent = "جست‌وجو فعلاً در دسترس نیست؛ آرشیوهای موضوعی را امتحان کن."; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      const url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
      renderSearchResults(items, query, results, status);
    });
  }

  function setupReadingProgress() {
    const article = document.querySelector("[data-reading-article]");
    const progress = document.getElementById("reading-progress");
    const status = document.getElementById("reading-status");
    if (!article || !progress || !status) return;
    const toc = document.querySelector(".reading-rail__toc");
    if (toc) {
      const mobile = window.matchMedia("(max-width: 700px)");
      const syncToc = () => {
        if (mobile.matches) toc.removeAttribute("open");
        else toc.setAttribute("open", "");
      };
      syncToc();
      if (mobile.addEventListener) mobile.addEventListener("change", syncToc);
      else mobile.addListener(syncToc);
    }
    let scheduled = false;
    function update() {
      scheduled = false;
      const rect = article.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const total = Math.max(article.offsetHeight - viewport * 0.55, 1);
      const passed = Math.min(Math.max(viewport * 0.35 - rect.top, 0), total);
      const value = Math.round((passed / total) * 100);
      progress.value = value;
      status.textContent = `${value}٪ خوانده شده`;
    }
    function schedule() {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const links = [...document.querySelectorAll(".reading-rail a")];
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.removeAttribute("aria-current"));
        const active = links.find((link) => link.getAttribute("href") === `#${entry.target.id}`);
        if (active) active.setAttribute("aria-current", "true");
      }), { rootMargin: "-18% 0px -65% 0px", threshold: 0 });
      document.querySelectorAll(".article__body h2[id]").forEach((heading) => observer.observe(heading));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncThemeControls();
    document.querySelectorAll("input[data-theme-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        const nextTheme = input.checked ? "dark" : "light";
        if (nextTheme === "light") root.dataset.theme = "light";
        else delete root.dataset.theme;
        try { window.localStorage.setItem(storageKey, nextTheme); } catch (_) {}
        syncThemeControls();
      });
    });
    setupSearch();
    setupReadingProgress();
  });
})();
