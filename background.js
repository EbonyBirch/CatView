"use strict";

function catIcons(enabled) {
  const state = enabled ? "on" : "off";
  return Object.fromEntries(
    [16, 32, 48, 64, 128].map(size => [size, `icons/cat-${state}-${size}.png`])
  );
}

browser.browserAction.onClicked.addListener(async tab => {
  try {
    const result = await browser.recursiveView.toggle(tab.id);
    // The white cat means OFF. The black cat means ON.
    await browser.browserAction.setIcon({tabId: tab.id, path: catIcons(result.enabled)});
    await browser.browserAction.setTitle({
      tabId: tab.id,
      title: result.enabled ? "CatView: ON" : "CatView: OFF"
    });
    // Icon + title convey the state; don't clutter the toolbar with an ON badge.
    await browser.browserAction.setBadgeText({tabId: tab.id, text: ""});
  } catch (error) {
    console.error("[CatView]", error);
    await browser.browserAction.setBadgeText({tabId: tab.id, text: "!"});
    await browser.browserAction.setBadgeBackgroundColor({tabId: tab.id, color: "#b43232"});
    await browser.browserAction.setTitle({tabId: tab.id, title: "CatView: ERROR"});
  }
});
