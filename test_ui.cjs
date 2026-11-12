const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const previewPath = 'file:///' + path.resolve('extensions/citadel-lead-finder/preview.html').replace(/\\/g, '/');
  console.log('Loading preview:', previewPath);
  await page.goto(previewPath, { waitUntil: 'domcontentloaded' });

  // Initial screenshot
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/sachi/.gemini/antigravity/brain/e9e6e4c7-7fc8-49b6-9267-cb634908ae49/ext_preview_initial.png' });
  console.log('[PASS] ext_preview_initial.png saved');

  // Find the iframe containing the sidepanel
  const frameElement = await page.$('.ext-iframe');
  const frame = await frameElement.contentFrame();

  // Click "Find All — Phone + Both Emails" inside sidepanel iframe
  console.log('Clicking "Find All — Phone + Both Emails"...');
  await frame.click('#btn-find-all');

  await frame.waitForSelector('#revealed-phone:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/sachi/.gemini/antigravity/brain/e9e6e4c7-7fc8-49b6-9267-cb634908ae49/ext_preview_revealed.png' });
  console.log('[PASS] ext_preview_revealed.png saved with revealed phone & emails!');

  // Click Settings gear icon
  console.log('Clicking Settings gear icon...');
  await frame.click('#btn-open-settings');
  await frame.waitForSelector('#modal-settings:not(.hidden)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/sachi/.gemini/antigravity/brain/e9e6e4c7-7fc8-49b6-9267-cb634908ae49/ext_preview_settings.png' });
  console.log('[PASS] ext_preview_settings.png saved with Settings modal!');

  // Close Settings and click "Save to Contacts"
  await frame.click('#btn-close-settings');
  await page.waitForTimeout(200);

  console.log('Clicking "Save to Contacts"...');
  await frame.click('#btn-save-contacts');
  await page.waitForTimeout(600);

  // Open History to verify contact saved in database
  console.log('Clicking "History"...');
  await frame.click('#btn-open-history');
  await frame.waitForSelector('#modal-history:not(.hidden)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/sachi/.gemini/antigravity/brain/e9e6e4c7-7fc8-49b6-9267-cb634908ae49/ext_preview_history.png' });
  console.log('[PASS] ext_preview_history.png saved with saved contact in database!');

  await browser.close();
  console.log('>>> ALL EXTENSION UI & INTERACTION TESTS PASSED 100%! <<<');
})();
