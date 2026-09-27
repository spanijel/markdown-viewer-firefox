const REVIEWER = "reviewer.html";

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create({ id: "review-selection", title: "Preview selected Markdown", contexts: ["selection"] });
  browser.menus.create({ id: "review-link", title: "Preview Markdown link", contexts: ["link"] });
});

browser.action.onClicked.addListener(() => browser.tabs.create({ url: browser.runtime.getURL(REVIEWER) }));

browser.menus.onClicked.addListener(async info => {
  const key = crypto.randomUUID();
  let input;
  if (info.menuItemId === "review-selection") {
    input = { name: "Selected Markdown", content: info.selectionText || "" };
  } else if (info.menuItemId === "review-link") {
    let url;
    try { url = new URL(info.linkUrl); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol)) return;
    const origin = `${url.origin}/*`;
    if (!await browser.permissions.request({ origins: [origin] })) return;
    input = { name: url.pathname.split('/').pop() || 'Markdown link', url: url.href };
  } else {
    return;
  }
  await browser.storage.local.set({ [key]: input });
  await browser.tabs.create({ url: browser.runtime.getURL(`${REVIEWER}?input=${key}`) });
});
