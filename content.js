/**
 * SalesRocket Content Script
 * Scrapes profile information, hidden HTML fields, contact overlay, watches SPA navigation, and injects floating trigger tab
 */

(function () {
  'use strict';

  // Guard against invalidated extension context
  function isExtensionValid() {
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function safeSendMessage(msg, callback) {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime?.lastError) {
          // Suppress error if listener is not open
        }
        if (typeof callback === 'function') {
          try { callback(response); } catch (_) {}
        }
      });
    } catch (_) {
      // Suppress synchronous extension context invalidated errors
    }
  }

  // Inject floating edge tab
  function injectFloatingEdgeTab() {
    if (document.getElementById('salesrocket-floating-tab')) return;

    const host = document.createElement('div');
    host.id = 'salesrocket-floating-tab';
    
    const tabInner = document.createElement('div');
    tabInner.id = 'salesrocket-floating-inner';
    tabInner.style.cssText = `
      position: fixed;
      right: 0;
      top: 48%;
      transform: translateY(-50%);
      background: #2563EB;
      color: #ffffff;
      padding: 12px 7px;
      border-radius: 8px 0 0 8px;
      box-shadow: -3px 3px 12px rgba(37, 99, 235, 0.35);
      cursor: pointer;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', Segoe UI, Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      user-select: none;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      border-left: 2px solid #60A5FA;
      transition: transform 0.15s, background 0.15s;
    `;
    tabInner.innerHTML = `
      <span style="writing-mode: horizontal-tb; margin-bottom: 2px; color: #ffffff;">⚡</span>
      <span>SalesRocket</span>
    `;

    tabInner.addEventListener('mouseenter', () => {
      tabInner.style.background = '#1D4ED8';
      tabInner.style.transform = 'translateY(-50%) translateX(-3px)';
    });

    tabInner.addEventListener('mouseleave', () => {
      tabInner.style.background = '#2563EB';
      tabInner.style.transform = 'translateY(-50%) translateX(0)';
    });

    tabInner.addEventListener('click', () => {
      safeSendMessage({ action: 'TOGGLE_SIDEPANEL' });
    });

    host.appendChild(tabInner);

    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(host));
    }
  }

  // Extract contact info from DOM element root
  function extractContactFromElements(root) {
    if (!root) return {};
    const res = {};

    // 1. Phone Links
    const telLinks = root.querySelectorAll('a[href^="tel:"]');
    for (const a of telLinks) {
      const raw = a.getAttribute('href').replace(/^tel:/i, '').trim();
      if (raw && !res.phone) res.phone = raw;
    }

    // 2. Phone container sections
    if (!res.phone) {
      const phoneSections = root.querySelectorAll('.ci-phone, section.ci-phone, [data-field="phone_number"]');
      for (const sec of phoneSections) {
        const span = sec.querySelector('.t-14, span, ul li') || sec;
        const txt = (span.innerText || '').trim();
        const m = txt.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
        if (m && !res.phone) {
          res.phone = m[0];
        } else if (txt && !res.phone && /\d{8,}/.test(txt)) {
          res.phone = txt.split('\n')[0].replace(/\(.*?\)/g, '').trim();
        }
      }
    }

    // 3. Email Links
    const mailtoLinks = root.querySelectorAll('a[href^="mailto:"]');
    for (const a of mailtoLinks) {
      const raw = a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim();
      if (raw && !res.email) res.email = raw;
    }

    // 4. Email container sections
    if (!res.email) {
      const emailSections = root.querySelectorAll('.ci-email, section.ci-email, [data-field="email_address"]');
      for (const sec of emailSections) {
        const a = sec.querySelector('a') || sec;
        const txt = (a.innerText || '').trim();
        const m = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (m && !res.email) res.email = m[0];
      }
    }

    // 5. Websites
    const siteSections = root.querySelectorAll('.ci-websites, section.ci-websites');
    for (const sec of siteSections) {
      const links = sec.querySelectorAll('a');
      for (const link of links) {
        const href = (link.href || link.innerText || '').trim();
        if (href && !href.includes('linkedin.com')) {
          if (!res.websites) res.websites = [];
          if (!res.websites.includes(href)) res.websites.push(href);
        }
      }
    }

    return res;
  }

  // Extract contact info from LinkedIn hidden <code> tags and inline JSON
  function extractContactFromHiddenCodeTags() {
    const res = {};
    const codeEls = document.querySelectorAll('code');
    for (const codeEl of codeEls) {
      let text = codeEl.textContent || '';
      if (!text) continue;
      text = text.trim();
      if (text.startsWith('<!--') && text.endsWith('-->')) {
        text = text.slice(4, -3).trim();
      }
      if (!text.includes('phoneNumbers') && !text.includes('emailAddress') && !text.includes('ProfileContactInfo') && !text.includes('websites')) {
        continue;
      }
      try {
        const data = JSON.parse(text);
        function searchObj(o) {
          if (!o || typeof o !== 'object') return;
          if (o.emailAddress && !res.email && typeof o.emailAddress === 'string') {
            res.email = o.emailAddress.trim();
          }
          if (o.phoneNumbers && Array.isArray(o.phoneNumbers)) {
            for (const p of o.phoneNumbers) {
              const num = p.number || p.rawNumber;
              if (num && !res.phone) res.phone = String(num).trim();
            }
          }
          if (o.phoneNumber && !res.phone) {
            const num = typeof o.phoneNumber === 'string' ? o.phoneNumber : (o.phoneNumber.number || o.phoneNumber.rawNumber);
            if (num) res.phone = String(num).trim();
          }
          if (o.websites && Array.isArray(o.websites) && !res.websites) {
            res.websites = o.websites.map(w => w.url || w).filter(Boolean);
          }
          for (const k of Object.keys(o)) {
            if (typeof o[k] === 'object') searchObj(o[k]);
          }
        }
        searchObj(data);
      } catch (_) {
        // Regex fallback
        if (!res.email) {
          const emMatch = text.match(/"emailAddress"\s*:\s*"([^"]+)"/i);
          if (emMatch) res.email = emMatch[1];
        }
        if (!res.phone) {
          const phMatch = text.match(/"(?:number|phoneNumber|rawNumber)"\s*:\s*"([^"]+)"/i);
          if (phMatch) res.phone = phMatch[1];
        }
      }
      if (res.phone && res.email) break;
    }
    return res;
  }

  // Extract from active Contact Info modal
  function extractContactFromModal() {
    const modal = document.querySelector('.artdeco-modal, div[role="dialog"], #artdeco-modal-outlet, .pv-profile-section__section-info');
    if (modal) {
      return extractContactFromElements(modal);
    }
    return {};
  }

  // Proactive background fetch of contact overlay
  const fetchedSlugs = new Set();
  function fetchContactOverlayAsync(slug) {
    if (!slug || fetchedSlugs.has(slug)) return;
    fetchedSlugs.add(slug);

    const overlayUrl = `/in/${slug}/overlay/contact-info/`;
    fetch(overlayUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then(r => r.text())
      .then(html => {
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const overlayData = extractContactFromElements(doc.body);

        // Check embedded code tags in overlay html
        const codeTags = doc.querySelectorAll('code');
        for (const codeEl of codeTags) {
          let t = (codeEl.textContent || '').trim();
          if (t.startsWith('<!--') && t.endsWith('-->')) t = t.slice(4, -3).trim();
          const em = t.match(/"emailAddress"\s*:\s*"([^"]+)"/i);
          if (em && !overlayData.email) overlayData.email = em[1];
          const ph = t.match(/"(?:number|phoneNumber|rawNumber)"\s*:\s*"([^"]+)"/i);
          if (ph && !overlayData.phone) overlayData.phone = ph[1];
        }

        if (overlayData.phone || overlayData.email || overlayData.websites) {
          const profile = scrapeLinkedIn();
          if (overlayData.phone) profile.phone = overlayData.phone;
          if (overlayData.email) profile.email = overlayData.email;
          if (overlayData.websites && overlayData.websites.length) profile.websites = overlayData.websites;
          safeSendMessage({ action: 'PROFILE_UPDATED', profile: profile, url: window.location.href });
        }
      })
      .catch(() => {});
  }

  // Scrape full profile info from LinkedIn DOM, hidden fields & overlays
  function scrapeLinkedIn() {
    let name = '';
    let role = '';
    let company = '';
    let location = '';

    const nameEl = document.querySelector('h1.text-heading-xlarge') ||
                   document.querySelector('h1.top-card-layout__title') ||
                   document.querySelector('.pv-top-card--list .inline.t-24') ||
                   document.querySelector('main h1') ||
                   document.querySelector('h1');
    if (nameEl) {
      name = nameEl.innerText.replace(/[\n\r]+.*$/, '').trim();
    }

    // Fallback to document.title if h1 not ready
    if (!name) {
      let docTitle = document.title || '';
      docTitle = docTitle.replace(/^\(\d+\)\s*/, '');
      docTitle = docTitle.replace(/\s*[|\-–]\s*LinkedIn.*$/i, '').trim();
      if (docTitle && !/https?:\/\/|linkedin\.com/i.test(docTitle)) {
        name = docTitle;
      }
    }

    const roleEl = document.querySelector('div.text-body-medium') ||
                   document.querySelector('.top-card-layout__headline') ||
                   document.querySelector('.pv-top-card--list + div') ||
                   document.querySelector('.text-body-medium.break-words');
    if (roleEl) role = roleEl.innerText.trim();

    const locEl = document.querySelector('.text-body-small.inline.t-black--light') ||
                  document.querySelector('.top-card-layout__first-subline') ||
                  document.querySelector('.pv-top-card--list-bullet > li');
    if (locEl) location = locEl.innerText.trim();

    const compEl = document.querySelector('.inline-show-more-text--is-collapsed') ||
                   document.querySelector('[aria-label="Current company"]') ||
                   document.querySelector('.pv-text-details__right-panel .hoverable-link-text');
    if (compEl) company = compEl.innerText.trim();

    // If company not found from dedicated element, parse from role headline
    if (!company && role) {
      const atMatch = role.match(/[@|at]\s+([^|•·\n,]+)/i);
      if (atMatch) company = atMatch[1].trim();
    }

    const urlMatch = window.location.href.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    const slug = urlMatch ? urlMatch[1] : '';

    // Deep Contact Extraction (Modal -> Hidden Code Tags -> Page DOM)
    const modalData = extractContactFromModal();
    const hiddenData = extractContactFromHiddenCodeTags();
    const pageData = extractContactFromElements(document.body);

    const phone = modalData.phone || hiddenData.phone || pageData.phone || '';
    const email = modalData.email || hiddenData.email || pageData.email || '';
    const websites = modalData.websites || hiddenData.websites || pageData.websites || [];

    // If phone or email not yet present in active DOM, trigger async overlay fetch
    if ((!phone || !email) && slug) {
      fetchContactOverlayAsync(slug);
    }

    return {
      name: name,
      role: role,
      company: company,
      location: location,
      slug: slug,
      url: window.location.href,
      phone: phone,
      email: email,
      websites: websites
    };
  }

  // SPA navigation detection
  let lastUrl = window.location.href;
  function notifyChange() {
    if (!isExtensionValid()) return;
    const currentUrl = window.location.href;
    const profile = scrapeLinkedIn();
    safeSendMessage({ action: 'urlChanged', url: currentUrl, profile: profile });
    safeSendMessage({ action: 'PROFILE_UPDATED', profile: profile, url: currentUrl });
  }

  const origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    setTimeout(notifyChange, 100);
  };

  const origReplace = history.replaceState;
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    setTimeout(notifyChange, 100);
  };

  window.addEventListener('popstate', () => setTimeout(notifyChange, 100));

  // MutationObserver to catch title/name/contact updates when navigating in SPA
  let obsTimer = null;
  const observer = new MutationObserver(() => {
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }
    if (window.location.href.includes('linkedin.com/in/')) {
      if (obsTimer) clearTimeout(obsTimer);
      obsTimer = setTimeout(() => {
        const profile = scrapeLinkedIn();
        if (profile.name) {
          safeSendMessage({ action: 'PROFILE_UPDATED', profile: profile, url: window.location.href });
        }
      }, 250);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    injectFloatingEdgeTab();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      injectFloatingEdgeTab();
    });
  }

  // Fire initial notification once DOM is parsed
  setTimeout(notifyChange, 350);

  // Respond to sidepanel messages
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (!isExtensionValid()) return;
      if (req.action === 'SCRAPE_LINKEDIN_PROFILE' || req.action === 'GET_PROFILE') {
        const profile = scrapeLinkedIn();
        sendResponse(profile);
      }
    });
  }
})();
