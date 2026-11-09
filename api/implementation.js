/* global ExtensionCommon, Ci */
"use strict";

// CatView: temporary native Thunderbird cross-folder message view.
// This is a privileged Experiment API relying on Thunderbird internals.

function getFolders(root) {
  // Always include the selected folder itself, then all of its real descendants.
  const folders = [root];
  const seen = new Set([root.URI]);
  for (const folder of root.descendants) {
    if (!folder || folder.isServer || (folder.flags & Ci.nsMsgFolderFlags.Virtual)) {
      continue;
    }
    if (!seen.has(folder.URI)) {
      folders.push(folder);
      seen.add(folder.URI);
    }
  }
  return folders;
}

function showLocationColumn(pane) {
  const location = pane.threadPane.columns.find(
    column => column.id.toLowerCase() === "locationcol"
  );
  if (location?.hidden) {
    location.hidden = false;
    pane.threadPane.updateColumns();
  }
}

function removeSearchListener(state) {
  if (state.session && state.searchListener) {
    try {
      state.session.unregisterListener(state.searchListener);
    } catch (error) {
      console.warn("[CatView] Could not detach previous search listener", error);
    }
  }
  state.session = null;
  state.searchListener = null;
}

/**
 * Recover messages in the current folder which the internal cross-folder
 * search view has omitted. This works with already-indexed message headers
 * (no message bodies are read, and nothing is altered in the mail store).
 *
 * The ordinary search scope already includes the parent folder, so we must
 * check what Thunderbird actually displayed to avoid duplicate rows.
 */
function reconcileParentFolder(view, folder) {
  const dbView = view.dbView;
  if (!dbView) {
    return 0;
  }

  const presentKeys = new Set();
  for (let i = 0; i < dbView.rowCount; i++) {
    const header = dbView.getMsgHdrAt(i);
    if (header?.folder?.URI === folder.URI) {
      presentKeys.add(header.messageKey);
    }
  }

  let added = 0;
  // nsIMsgFolder.messages enumerates precisely the selected folder's local
  // message headers; it does NOT recurse into its children.
  for (const header of folder.messages) {
    if (presentKeys.has(header.messageKey)) {
      continue;
    }
    dbView.QueryInterface(Ci.nsIMsgSearchNotify).onSearchHit(header, folder);
    presentKeys.add(header.messageKey);
    added++;
  }
  if (added) {
    console.info(`[CatView] Restored ${added} missing messages from ${folder.URI}`);
  }
  return added;
}

/**
 * Reserve the OFF state's actual button width (the larger label) before the
 * browserAction API changes its title to ON.  This keeps the toolbar stable
 * without invisible padding characters, hard-coded font metrics or global CSS.
 *
 * In Thunderbird >=115, extension browserAction buttons live in the main
 * window's unified toolbar and carry an `extension` attribute containing the
 * add-on ID. (See ext-browserAction.js getToolbarButton.)
 */
function stabilizeActionButton(tab, extensionId) {
  const chromeDocument = tab.chromeBrowser?.ownerDocument;
  const root = chromeDocument?.getElementById("unifiedToolbarContent");
  if (!root) {
    return;
  }
  const button = Array.from(root.querySelectorAll("[extension]"))
    .find(node => node.getAttribute("extension") === extensionId);
  if (!button) {
    return;
  }

  // Normally invoked while the default OFF title is still displayed.
  // A previous minWidth is retained, e.g. across tabs in the same window.
  const actualWidth = button.getBoundingClientRect().width;
  if (actualWidth > 0) {
    const existingWidth = Number.parseFloat(button.style.minWidth) || 0;
    button.style.minWidth = `${Math.ceil(Math.max(actualWidth, existingWidth))}px`;
  }
}

function openCatView(pane, state) {
  const folder = pane.gFolder;
  if (!folder || folder.isServer || (folder.flags & Ci.nsMsgFolderFlags.Virtual)) {
    return 0;
  }

  const folders = getFolders(folder);
  state.folderURI = folder.URI;
  removeSearchListener(state);

  if (folders.length < 2) {
    // For a leaf folder Thunderbird's normal view already includes all mail.
    // If our previous combined view is still shown, return to normal.
    if (pane.gViewWrapper?.isSearch) {
      restoreNormalView(pane);
    }
    return 1;
  }

  pane.threadPane.saveSelection();
  pane.messagePane.clearAll();
  pane.gViewWrapper?.close({leavingFolder: false});
  pane.gViewWrapper = new pane.DBViewWrapper(pane.dbViewWrapperListener);
  const view = pane.gViewWrapper;

  // In-memory result set. No virtual folders or persisted Saved Searches.
  view.openSearchView();
  view.beginViewUpdate();
  view.searchFolders = folders;
  const matchAll = view.search.session.createTerm();
  matchAll.matchAll = true;
  view.search.userTerms = [matchAll];

  // OnSearchDone occurs AFTER the search view has populated its result rows.
  // Register before ending the update to support synchronous local searches.
  const searchListener = {
    onNewSearch() {},
    onSearchHit() {},
    onSearchDone(status) {
      if (!state.enabled || pane.closed || pane.gViewWrapper !== view ||
          pane.gFolder?.URI !== folder.URI || status !== 0) {
        return;
      }
      try {
        reconcileParentFolder(view, folder);
      } catch (error) {
        console.error("[CatView] Parent-folder reconciliation failed", error);
      }
    }
  };
  state.session = view.search.session;
  state.searchListener = searchListener;
  state.session.registerListener(searchListener, Ci.nsIMsgSearchSession.onSearchDone);

  try {
    view.endViewUpdate();
    view.sort("dateCol", Ci.nsMsgViewSortOrder.descending);
  } catch (error) {
    removeSearchListener(state);
    throw error;
  }

  pane.threadPane.updateListRole(true);
  showLocationColumn(pane);
  pane.threadPaneHeader.onFolderSelected();
  return folders.length;
}

function restoreNormalView(pane) {
  // Ask Thunderbird to reconstruct the folder view without changing selection.
  if (!pane.closed && pane.folderTree && pane.gFolder) {
    pane.folderTree.dispatchEvent(new pane.CustomEvent("select"));
  }
}

function detach(pane, state, restore) {
  state.enabled = false;
  removeSearchListener(state);
  try {
    pane.folderTree?.removeEventListener("select", state.onSelect);
    pane.removeEventListener("unload", state.onUnload);
  } catch (_) {
    // A tab may have been torn down already.
  }
  if (restore) {
    restoreNormalView(pane);
  }
}

var recursiveView = class extends ExtensionCommon.ExtensionAPI {
  constructor(...args) {
    super(...args);
    this._states = new Map();
  }

  getAPI(context) {
    const extension = this;
    return {
      recursiveView: {
        async toggle(tabId) {
          const tab = context.extension.tabManager.get(tabId).nativeTab;
          if (!tab || tab.mode?.name !== "mail3PaneTab") {
            throw new Error("Select a regular mail-folder tab first.");
          }
          const pane = tab.chromeBrowser?.contentWindow;
          if (!pane || !pane.folderTree || !pane.threadPane || !pane.gFolder) {
            throw new Error("Folder view is not ready. Select a mail folder first.");
          }
          // Called before background.js changes the label from OFF to ON.
          // Failure to find the button is harmless: the mail view still works.
          try {
            stabilizeActionButton(tab, context.extension.id);
          } catch (error) {
            console.warn("[CatView] Toolbar width stabilization unavailable", error);
          }
          let state = extension._states.get(pane);
          if (state?.enabled) {
            detach(pane, state, true);
            extension._states.delete(pane);
            return {enabled: false, folder: pane.gFolder.localizedName, foldersIncluded: 1};
          }
          if (pane.gFolder.isServer || (pane.gFolder.flags & Ci.nsMsgFolderFlags.Virtual)) {
            throw new Error("Select an ordinary mail folder rather than an account or virtual folder.");
          }
          const allFolders = getFolders(pane.gFolder);
          if (allFolders.length < 2) {
            throw new Error("This folder has no subfolders to include.");
          }

          state = {
            enabled: true, folderURI: null, session: null, searchListener: null,
            onSelect: null, onUnload: null
          };
          state.onSelect = () => {
            if (!state.enabled) {
              return;
            }
            try {
              openCatView(pane, state);
            } catch (error) {
              console.error("[CatView] Folder change failed", error);
              detach(pane, state, true);
              extension._states.delete(pane);
            }
          };
          state.onUnload = () => {
            detach(pane, state, false);
            extension._states.delete(pane);
          };
          try {
            openCatView(pane, state);
          } catch (error) {
            removeSearchListener(state);
            restoreNormalView(pane);
            throw error;
          }
          pane.folderTree.addEventListener("select", state.onSelect);
          pane.addEventListener("unload", state.onUnload, {once: true});
          extension._states.set(pane, state);
          return {
            enabled: true,
            folder: pane.gFolder.localizedName,
            foldersIncluded: allFolders.length
          };
        }
      }
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return;
    }
    for (const [pane, state] of this._states) {
      detach(pane, state, true);
    }
    this._states.clear();
  }
};
