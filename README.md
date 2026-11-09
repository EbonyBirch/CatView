# CatView 0.2.1 — Thunderbird recursive folder view

A one-click toggle to concatenate the messages of the currently selected **real
mail folder and all of its descendants** into Thunderbird's native message list.
The folder in the tree does not change, and the **Location** column is enabled
in Table View so each message's original folder can be identified.

| State | Toolbar title | Icon | View |
| --- | --- | --- | --- |
| Disabled | CatView: OFF | White cat | Selected folder only |
| Enabled | CatView: ON | Black cat | Selected folder + every nested subfolder |

## Changes in version 0.2.1

- Stops the toolbar from shifting horizontally between **CatView: ON** and
  **CatView: OFF**. On first activation, captures the wider OFF button width
  and applies it as a minimum width to the existing unified-toolbar action.
  No fixed pixel constant, typography change, or invisible whitespace is used.
- Replaced both cat icons with the user-supplied revised illustrations; generated
  transparent PNGs at 16, 32, 48, 64 and 128 px while preserving the interior
  of the white cat, as well as white eye/ear highlights of the black cat.
- Combined-folder logic and parent-message recovery are unchanged from 0.2.0.

## Changes in version 0.2.0

- Renamed the visible add-on and button from Recursive Folder View to **CatView**.
- Removed verbose on/off descriptions from the toolbar title and removed the ON badge.
- Added distinct black/white cat icons made from the *user-provided* Vecteezy artwork (replaced by revised icons in 0.2.1).
- Added explicit artwork attribution and separated code and artwork licensing.
- Added a parent-folder reconciliation step: when Thunderbird's internal
  cross-folder results omit parent messages, CatView compares against the
  parent's local message headers and inserts only the missing messages.

## Installation / upgrading

1. Back up your Thunderbird profile before testing a privileged extension.
2. In Thunderbird choose **Add-ons and Themes → gear → Install Add-on From File**.
3. Select `CatView-0.2.1.xpi`.
4. Because the internal add-on ID is unchanged, this should upgrade version
   0.1.0 in place rather than creating a second copy.
5. If needed, add the **CatView** button in toolbar customization.
6. Switch the message list to **Table View** to see the **Location** column.

Select a folder with subfolders and click CatView to toggle. While enabled,
selecting another ordinary folder in the same mail tab refreshes the combined
view. Toggle OFF to restore Thunderbird's regular folder view.

## Design and limitations

- This add-on uses a privileged **MailExtension Experiment**, not the public
  Thunderbird API. It can break with changes to Thunderbird internals.
- There are **no permanent saved searches or virtual folders**, and CatView
  neither moves nor copies messages. Its native result view uses Thunderbird's
  temporary cross-folder search infrastructure.
- The parent-folder reconciliation reads local **message headers** only; it
  neither downloads message bodies nor modifies stored mail.
- Locally indexed headers are needed for the combined view. Recent IMAP changes
  may require folder synchronization to appear.
- New subfolders created while the same parent stays selected are picked up
  on the next folder selection.
- The **Location** column is Thunderbird's stock field; it usually shows the
  immediate folder name, not a custom full ancestry path.
- The mode is per mail tab and does not persist across Thunderbird restarts.
- Button width is measured on the first click in each Thunderbird main window,
  while OFF is displayed; if Thunderbird replaces the toolbar DOM element
  during customization, the width is measured again on the next click.
- Some operations in multi-folder native views (especially bulk move/delete)
  deserve extra caution. Start testing with a separate profile.
- As with version 0.1.0, **runtime execution in Thunderbird has not been
  verified here**. Static checks and focused mock tests do not replace that.
- Signing may be needed in Thunderbird distributions that enforce it.

## Artwork and license

Cat faces: **Fiaz jutt** (creator credited in the supplied EPS metadata),
provided through **Vecteezy.com** under its Free License. The cropped cat
images in the add-on derive from Vecteezy asset **#81585088**,
“Cute cat faces silhouettes and line art kitten heads set.”

**Artwork credit: Cat face illustrations by Fiaz jutt / Vecteezy.com — https://www.vecteezy.com/**

The artwork is **not licensed under MIT**. Observe Vecteezy's attribution and
usage terms before redistributing or publishing this add-on. See
`ARTWORK-CREDITS.md` for more information.

Source code is MIT-licensed (`LICENSE`).

## Architecture

- `background.js`: toolbar click, title, dynamic icon swapping
- `api/implementation.js`: native cross-folder view, search-results recovery
- `api/schema.json`: privileged Experiment API schema
- `icons/cat-on-*.png`, `icons/cat-off-*.png`: artist-derived toolbar icons

## Relevant Thunderbird sources

- https://developer.thunderbird.net/add-ons/mailextensions
- https://webextension-api.thunderbird.net/en/esr-mv2/guides/experiments.html
- https://github.com/thunderbird/thunderbird-desktop/blob/main/mail/modules/DBViewWrapper.sys.mjs
- https://github.com/thunderbird/thunderbird-desktop/blob/main/mail/modules/SearchSpec.sys.mjs
