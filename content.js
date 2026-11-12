/**
 * SalesRocket Content Script
 * Scrapes profile information, watches SPA navigation, and injects floating trigger tab
 */

(function () {
  'use strict';

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
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'TOGGLE_SIDEPANEL' }).catch(() => {});
      }
    });

    host.appendChild(tabInner);

    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(host));
    }
  }

  // Scrape profile info from LinkedIn DOM
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

    // If company not found from dedicated element, parse from role headline (e.g. "@ Nyara AI", "at Webmentix")
    if (!company && role) {
      const atMatch = role.match(/[@|at]\s+([^|•·\n,]+)/i);
      if (atMatch) company = atMatch[1].trim();
    }

    const urlMatch = window.location.href.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    const slug = urlMatch ? urlMatch[1] : '';

    return {
      name: name,
      role: role,
      company: company,
      location: location,
      slug: slug,
      url: window.location.href
    };
  }

  // SPA navigation detection
  let lastUrl = window.location.href;
  function notifyChange() {
    const currentUrl = window.location.href;
    const profile = scrapeLinkedIn();
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'urlChanged', url: currentUrl, profile: profile }).catch(() => {});
      chrome.runtime.sendMessage({ action: 'PROFILE_UPDATED', profile: profile, url: currentUrl }).catch(() => {});
    }
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

  // MutationObserver to catch title/name updates when navigating in SPA
  let obsTimer = null;
  const observer = new MutationObserver(() => {
    if (window.location.href.includes('linkedin.com/in/')) {
      if (obsTimer) clearTimeout(obsTimer);
      obsTimer = setTimeout(() => {
        const profile = scrapeLinkedIn();
        if (profile.name && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'PROFILE_UPDATED', profile: profile, url: window.location.href }).catch(() => {});
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
      if (req.action === 'SCRAPE_LINKEDIN_PROFILE' || req.action === 'GET_PROFILE') {
        const profile = scrapeLinkedIn();
        sendResponse(profile);
      }
    });
  }
})();
