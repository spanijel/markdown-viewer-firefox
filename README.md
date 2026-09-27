# Markdown Reviewer for Firefox

Open the reviewer with the toolbar button, then choose or drop a local `.md`, `.markdown`, or `.txt` file.
Right-click selected text and choose **Preview selected Markdown** to preview it.
Right-click a link and choose **Preview Markdown link** to fetch its text after granting access to that site.
The link action supports HTTP and HTTPS URLs and limits the loaded file to 2 MB.

The add-on processes Markdown in the browser.
It has no analytics, account, or server run by the add-on author.
Selecting a link downloads that file directly from its site.
Images in Markdown can load from their source sites.

## Local test

Open `about:debugging` in Firefox, choose **This Firefox** and **Load Temporary Add-on**, then select `manifest.json` in this directory.
Test the toolbar button, a text selection, a link to a Markdown file, the file picker, and drag and drop.

## AMO submission

From the repository root, create the upload archive:

```sh
zip -9 markdown-reviewer-firefox-1.0.1.zip manifest.json background.js reviewer.html reviewer.css reviewer.js
```

Upload that archive to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/).
This repository is the complete, readable source; there is no compilation or third-party dependency.
For reviewer notes, use the local test steps above.

Suggested summary: Preview and edit Markdown files, selected text, and linked Markdown in Firefox.

Suggested description: Open local Markdown files with a file picker or drag and drop. Preview selected Markdown from the Firefox context menu, or preview a linked Markdown file after granting access to its site. Edit the text, copy rendered HTML, download HTML, or print to PDF. Markdown stays in your browser; there is no account or analytics.
