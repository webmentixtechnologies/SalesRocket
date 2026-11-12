/**
 * SalesRocket Background Service Worker (Manifest V3)
 * Monitors tab navigation, active tab switches, and relays URL changes to Sidepanel
 */

'use strict';

// Set default side panel behavior to open on action click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// Listen for action click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open && tab) {
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

// Track URLs per tab to detect SPA transitions
const tabUrls = {};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    const newUrl = changeInfo.url || tab.url;
    if (!newUrl) return;
    const oldUrl = tabUrls[tabId];
    tabUrls[tabId] = newUrl;

    if (oldUrl !== newUrl || changeInfo.status === 'complete') {
      chrome.runtime.sendMessage({
        type: 'URL_CHANGED',
        url: newUrl,
        tabId: tabId,
        title: tab.title
      }).catch(() => {}); // ignore if no sidepanel open
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      tabUrls[activeInfo.tabId] = tab.url;
      chrome.runtime.sendMessage({
        type: 'URL_CHANGED',
        url: tab.url,
        tabId: activeInfo.tabId,
        title: tab.title
      }).catch(() => {});
    }
  } catch (_) {}
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabUrls[tabId];
});

// Listen for messages from content script & sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TOGGLE_SIDEPANEL' && sender.tab) {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'urlChanged' && sender.tab) {
    chrome.runtime.sendMessage({
      type: 'URL_CHANGED',
      url: message.url,
      tabId: sender.tab.id,
      title: sender.tab.title,
      profile: message.profile
    }).catch(() => {});
  }

  if (message.action === 'PROFILE_UPDATED' && sender.tab) {
    chrome.runtime.sendMessage({
      type: 'PROFILE_UPDATED',
      profile: message.profile,
      url: message.url || sender.tab.url,
      tabId: sender.tab.id,
      title: sender.tab.title
    }).catch(() => {});
  }
});
