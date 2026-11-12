/**
 * SalesRocket Content Script
 * Scrapes profile information, hidden HTML fields, Voyager contact API, watches SPA navigation, and injects floating trigger tab
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
    const codeEls = document.querySelectorAll('code, script[type="application/ld+json"], script[type="application/json"]');
    for (const codeEl of codeEls) {
      let raw = codeEl.textContent || '';
      if (!raw) continue;
      let text = raw.trim();
      if (text.startsWith('<!--') && text.endsWith('-->')) {
        text = text.slice(4, -3).trim();
      }
      if (text.includes('&quot;') || text.includes('&amp;')) {
        text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }

      const hasPhone = /number|phone|mobile|tel/i.test(text);
      const hasEmail = /email|mail/i.test(text);
      const hasSite = /websites|website|customType/i.test(text);

      if (!hasPhone && !hasEmail && !hasSite) continue;

      try {
        const data = JSON.parse(text);
        function searchObj(o) {
          if (!o || typeof o !== 'object') return;
          if ((o.emailAddress || o.email || o.primaryEmail) && !res.email) {
            const em = o.emailAddress || o.email || o.primaryEmail;
            if (typeof em === 'string' && em.includes('@')) res.email = em.trim();
          }
          if (o.phoneNumbers && Array.isArray(o.phoneNumbers)) {
            for (const p of o.phoneNumbers) {
              const num = p.number || p.rawNumber || p.phoneNumber || p;
              if (num && !res.phone && typeof num === 'string' && num.replace(/[^0-9]/g, '').length >= 7) {
                res.phone = num.trim();
              }
            }
          }
          if ((o.phoneNumber || o.phone || o.mobileNumber || o.rawNumber) && !res.phone) {
            const target = o.phoneNumber || o.phone || o.mobileNumber || o.rawNumber;
            const num = typeof target === 'string' ? target : (target.number || target.rawNumber);
            if (num && typeof num === 'string' && num.replace(/[^0-9]/g, '').length >= 7) {
              res.phone = num.trim();
            }
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
        if (!res.email) {
          const emMatch = text.match(/"(?:emailAddress|email|primaryEmail)"\s*:\s*"([^"]+@[-a-zA-Z0-9.]+)"/i) ||
                          text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emMatch) res.email = (emMatch[1] || emMatch[0]).trim();
        }
        if (!res.phone) {
          const phMatch = text.match(/"(?:number|phoneNumber|rawNumber|phone|mobile)"\s*:\s*"([+0-9\s()-]{7,25})"/i);
          if (phMatch) res.phone = phMatch[1].trim();
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

  // Fetch Voyager Contact API directly using active session cookies
  async function fetchVoyagerContactInfo(slug) {
    if (!slug) return null;
    try {
      const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      const headers = {
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'X-RestLi-Protocol-Version': '2.0.0'
      };
      if (csrf) headers['csrf-token'] = csrf;

      const resp = await fetch(`/voyager/api/identity/profiles/${encodeURIComponent(slug)}/profileContactInfo`, {
        credentials: 'include',
        headers: headers
      });
      if (resp.ok) {
        const json = await resp.json();
        const contact = {};
        if (json.emailAddress) contact.email = json.emailAddress;
        if (json.phoneNumbers && json.phoneNumbers[0]) {
          contact.phone = json.phoneNumbers[0].number || json.phoneNumbers[0].rawNumber;
        }
        if (json.websites && Array.isArray(json.websites)) {
          contact.websites = json.websites.map(w => w.url).filter(Boolean);
        }
        return contact;
      }
    } catch (_) {}
    return null;
  }

  // Trigger silent extraction by opening contact info link and closing it instantly
  let isExtractingSilently = false;
  function triggerSilentContactModalExtraction(callback) {
    if (isExtractingSilently) return;
    const btn = document.querySelector('#top-card-text-details-contact-info, a[href*="/overlay/contact-info/"], button[aria-label*="contact info" i]');
    if (!btn) {
      if (typeof callback === 'function') callback({});
      return;
    }
    isExtractingSilently = true;

    // Create stealth style to prevent modal from flashing on user screen
    const style = document.createElement('style');
    style.id = 'sr-stealth-modal-style';
    style.textContent = `
      #artdeco-modal-outlet .artdeco-modal,
      div[role="dialog"].artdeco-modal {
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        top: -9999px !important;
      }
      .artdeco-modal-overlay {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    btn.click();

    setTimeout(() => {
      const modal = document.querySelector('.artdeco-modal, div[role="dialog"]');
      let extracted = {};
      if (modal) {
        extracted = extractContactFromElements(modal);
        const closeBtn = modal.querySelector('.artdeco-modal__dismiss, [aria-label="Dismiss"], button[data-test-modal-close-btn]');
        if (closeBtn) closeBtn.click();
        else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        }
      }

      setTimeout(() => {
        style.remove();
        isExtractingSilently = false;
      }, 150);

      if (typeof callback === 'function') callback(extracted);

      if (extracted.phone || extracted.email) {
        const profile = scrapeLinkedIn();
        if (extracted.phone) profile.phone = extracted.phone;
        if (extracted.email) profile.email = extracted.email;
        if (extracted.websites) profile.websites = extracted.websites;
        safeSendMessage({ action: 'PROFILE_UPDATED', profile, url: window.location.href });
      }
    }, 250);
  }

  // Proactive background fetch of contact overlay
  const fetchedSlugs = new Set();
  async function fetchContactOverlayAsync(slug) {
    if (!slug || fetchedSlugs.has(slug)) return;
    fetchedSlugs.add(slug);

    // 1. Try Voyager API first
    const voyagerContact = await fetchVoyagerContactInfo(slug);
    if (voyagerContact && (voyagerContact.phone || voyagerContact.email)) {
      const profile = scrapeLinkedIn();
      if (voyagerContact.phone) profile.phone = voyagerContact.phone;
      if (voyagerContact.email) profile.email = voyagerContact.email;
      if (voyagerContact.websites) profile.websites = voyagerContact.websites;
      safeSendMessage({ action: 'PROFILE_UPDATED', profile, url: window.location.href });
      return;
    }

    // 2. Try overlay route
    try {
      const overlayUrl = `/in/${slug}/overlay/contact-info/`;
      const r = await fetch(overlayUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const html = await r.text();
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const overlayData = extractContactFromElements(doc.body);
        if (overlayData.phone || overlayData.email) {
          const profile = scrapeLinkedIn();
          if (overlayData.phone) profile.phone = overlayData.phone;
          if (overlayData.email) profile.email = overlayData.email;
          if (overlayData.websites && overlayData.websites.length) profile.websites = overlayData.websites;
          safeSendMessage({ action: 'PROFILE_UPDATED', profile, url: window.location.href });
          return;
        }
      }
    } catch (_) {}

    // 3. Fallback to silent modal extraction
    triggerSilentContactModalExtraction();
  }

  // Scrape full profile info from LinkedIn DOM, right panel, hidden fields & overlays
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

    // Comprehensive Company Extraction from Top Card Right Panel & DOM
    const rightPanelItem = document.querySelector('.pv-text-details__right-panel li button span[aria-hidden="true"], .pv-text-details__right-panel li button, .pv-text-details__right-panel li, .pv-text-details__right-panel');
    if (rightPanelItem) {
      const text = rightPanelItem.innerText.replace(/[\n\r]+.*$/, '').trim();
      if (text && !/University|College|School|Institute/i.test(text)) {
        company = text;
      }
    }

    if (!company) {
      const compLink = document.querySelector('.pv-top-card a[href*="/company/"], main a[href*="/company/"]');
      if (compLink) {
        const text = compLink.innerText.replace(/[\n\r]+.*$/, '').trim();
        if (text) company = text;
      }
    }

    if (!company) {
      const expCompany = document.querySelector('#experience ~ .pvs-list__outer-container span[aria-hidden="true"]');
      if (expCompany) company = expCompany.innerText.trim();
    }

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

    // If phone or email not yet present in active DOM, trigger proactive fetch
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


  // RocketReach profile & contacts scraper
  function scrapeRocketReach() {
    if (!window.location.host.includes('rocketreach.co')) return null;

    let name = '';
    const nameEl = document.querySelector('.rr-search-result-name, h3.name, .profile-name, h1, a[href*="/person/"]');
    if (nameEl) name = nameEl.innerText.replace(/[\n\r]+.*$/, '').trim();

    let company = '';
    let role = '';
    const roleEl = document.querySelector('.job-title, .rr-search-result-title, .title');
    if (roleEl) role = roleEl.innerText.trim();
    const compEl = document.querySelector('.company-name, .rr-search-result-company, a[href*="/companies/"], a[href*="/company/"]');
    if (compEl) company = compEl.innerText.trim();

    const emails = [];
    const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
    for (const a of mailLinks) {
      const em = a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim();
      if (em && !emails.includes(em)) emails.push(em);
    }
    const allText = document.body ? (document.body.innerText || '') : '';
    const emailMatches = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const em of emailMatches) {
      if (!emails.includes(em) && !/rocketreach\.co|sentry\.io|w3\.org/i.test(em)) {
        emails.push(em);
      }
    }

    const phones = [];
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    for (const a of telLinks) {
      const ph = a.getAttribute('href').replace(/^tel:/i, '').trim();
      if (ph && !phones.includes(ph)) phones.push(ph);
    }
    const phoneMatches = allText.match(/(?:\+1|\+91)[-\s]?(?:\d{3}[-\s]?\d{3}[-\s]?[0-9X]{4})/g) || [];
    for (const ph of phoneMatches) {
      if (!phones.includes(ph)) phones.push(ph);
    }

    let linkedinUrl = '';
    const liLink = document.querySelector('a[href*="linkedin.com/in/"]');
    if (liLink) linkedinUrl = liLink.href;
    const slug = linkedinUrl ? (linkedinUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/) || [])[1] : '';

    const payload = {
      source: 'rocketreach',
      name,
      company,
      role,
      emails,
      phones,
      linkedinUrl,
      slug
    };

    if (isExtensionValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const cleanN = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const storageObj = {};
      if (slug) storageObj['rr_' + slug] = payload;
      if (cleanN) storageObj['rr_name_' + cleanN] = payload;
      chrome.storage.local.set(storageObj, () => {});
    }

    return payload;
  }

  // SPA navigation detection
  let lastUrl = window.location.href;
  function notifyChange() {
    if (!isExtensionValid()) return;
    if (window.location.host.includes('rocketreach.co')) {
      const rr = scrapeRocketReach();
      if (rr) safeSendMessage({ action: 'ROCKETREACH_UPDATED', data: rr });
      return;
    }
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
      if (req.action === 'DEEP_EXTRACT_CONTACT') {
        const profile = scrapeLinkedIn();
        if (profile.phone && profile.email) {
          sendResponse(profile);
        } else {
          // Trigger deep extraction on demand and respond
          triggerSilentContactModalExtraction((extracted) => {
            if (extracted.phone) profile.phone = extracted.phone;
            if (extracted.email) profile.email = extracted.email;
            if (extracted.websites) profile.websites = extracted.websites;
            sendResponse(profile);
          });
          return true; // asynchronous response
        }
      }
    });
  }
})();
