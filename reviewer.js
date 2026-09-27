    const editor = document.getElementById("editor");
    const preview = document.getElementById("preview");
    const fileInput = document.getElementById("fileInput");
    const fileName = document.getElementById("fileName");
    const status = document.getElementById("status");
    const wordCount = document.getElementById("wordCount");
    const previewOnly = document.getElementById("previewOnly");
    const editorPane = document.getElementById("editorPane");
    const main = document.querySelector("main");
    const copyHtml = document.getElementById("copyHtml");
    const downloadHtml = document.getElementById("downloadHtml");
    const exportPdf = document.getElementById("exportPdf");
    const initialMarkdown = document.getElementById("initialMarkdown");

    function decodeBase64Utf8(value) {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    function fileStem(name) {
      const trimmed = (name || "").trim();
      const withoutExtension = trimmed.replace(/\.[^.]+$/, "");
      return withoutExtension || trimmed || "Markdown";
    }

    function setLoadedFileName(name) {
      const displayName = name || "Loaded Markdown";
      fileName.textContent = displayName;
      document.title = fileStem(displayName);
    }

    if (initialMarkdown) {
      try {
        const embedded = JSON.parse(initialMarkdown.textContent);
        editor.value = embedded.contentBase64 ? decodeBase64Utf8(embedded.contentBase64) : (embedded.content || "");
        setLoadedFileName(embedded.nameBase64 ? decodeBase64Utf8(embedded.nameBase64) : (embedded.name || "Loaded Markdown"));
      } catch (error) {
        setTimeout(() => setStatus("Could not load embedded Markdown"), 0);
      }
    }

    function escapeHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function inlineMarkdown(value) {
      let text = escapeHtml(value);
      const codeStore = [];
      text = text.replace(/`([^`]+)`/g, (_, code) => {
        codeStore.push(`<code>${code}</code>`);
        return `@@CODE${codeStore.length - 1}@@`;
      });
      text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, src, title) => {
        const safe = safeUrl(src, true);
        return safe ? `<img src="${safe}" alt="${alt}"${title ? ` title="${title}"` : ""}>` : alt;
      });
      text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, href, title) => {
        const safe = safeUrl(href, false);
        return safe ? `<a href="${safe}"${title ? ` title="${title}"` : ""} target="_blank" rel="noreferrer">${label}</a>` : label;
      });
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      text = text.replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, "$1<em>$2</em>");
      text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
      return text.replace(/@@CODE(\d+)@@/g, (_, index) => codeStore[Number(index)]);
    }

    function safeUrl(value, image) {
      try {
        const url = new URL(value.replace(/&amp;/g, "&"));
        if (!["https:", "http:", ...(image ? [] : ["mailto:"])].includes(url.protocol)) return "";
        return escapeHtml(url.href);
      } catch {
        return "";
      }
    }

    function parseTable(lines, start) {
      const header = lines[start];
      const divider = lines[start + 1];
      if (!divider || !/^\s*\|?[\s:|-]+\|[\s:|!-]*$/.test(divider)) {
        return null;
      }
      const rows = [];
      let index = start;
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
        rows.push(lines[index]);
        index += 1;
      }
      const cells = row => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => inlineMarkdown(cell.trim()));
      const headCells = cells(header).map(cell => `<th>${cell}</th>`).join("");
      const bodyRows = rows.slice(2).map(row => `<tr>${cells(row).map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
      return {
        html: `<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`,
        next: index
      };
    }

    function renderMarkdown(markdown) {
      const lines = markdown.replace(/\r\n/g, "\n").split("\n");
      const html = [];
      let index = 0;
      let paragraph = [];
      let list = null;
      let blockquote = [];

      function flushParagraph() {
        if (paragraph.length) {
          html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
          paragraph = [];
        }
      }

      function flushList() {
        if (list) {
          html.push(`<${list.type}>${list.items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
          list = null;
        }
      }

      function flushBlockquote() {
        if (blockquote.length) {
          html.push(`<blockquote>${renderMarkdown(blockquote.join("\n"))}</blockquote>`);
          blockquote = [];
        }
      }

      while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();

        if (/^```/.test(trimmed)) {
          flushParagraph();
          flushList();
          flushBlockquote();
          const language = trimmed.slice(3).trim();
          const code = [];
          index += 1;
          while (index < lines.length && !/^```/.test(lines[index].trim())) {
            code.push(lines[index]);
            index += 1;
          }
          html.push(`<pre><code${language ? ` data-language="${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
          index += 1;
          continue;
        }

        if (!trimmed) {
          flushParagraph();
          flushList();
          flushBlockquote();
          index += 1;
          continue;
        }

        const table = parseTable(lines, index);
        if (table) {
          flushParagraph();
          flushList();
          flushBlockquote();
          html.push(table.html);
          index = table.next;
          continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
          flushParagraph();
          flushList();
          flushBlockquote();
          const level = heading[1].length;
          html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
          index += 1;
          continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          flushParagraph();
          flushList();
          flushBlockquote();
          html.push("<hr>");
          index += 1;
          continue;
        }

        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
          flushParagraph();
          flushList();
          blockquote.push(quote[1]);
          index += 1;
          continue;
        }

        const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
        const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
        if (unordered || ordered) {
          flushParagraph();
          flushBlockquote();
          const type = unordered ? "ul" : "ol";
          if (!list || list.type !== type) {
            flushList();
            list = { type, items: [] };
          }
          list.items.push((unordered || ordered)[1]);
          index += 1;
          continue;
        }

        flushList();
        flushBlockquote();
        paragraph.push(line);
        index += 1;
      }

      flushParagraph();
      flushList();
      flushBlockquote();
      return html.join("\n");
    }

    function safePreviewNodes(html) {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const allowed = new Set([
        "A", "BLOCKQUOTE", "CODE", "DEL", "EM", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "IMG",
        "LI", "OL", "P", "PRE", "STRONG", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "UL"
      ]);

      function copy(node) {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
        if (node.nodeType !== Node.ELEMENT_NODE || !allowed.has(node.tagName)) return document.createTextNode(node.textContent);
        const element = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === "A") {
          const href = safeUrl(node.getAttribute("href") || "", false);
          if (href) {
            element.href = href.replace(/&amp;/g, "&");
            element.target = "_blank";
            element.rel = "noreferrer";
          }
        } else if (node.tagName === "IMG") {
          const src = safeUrl(node.getAttribute("src") || "", true);
          if (src) element.src = src.replace(/&amp;/g, "&");
          element.alt = node.getAttribute("alt") || "";
        } else if (node.tagName === "CODE" && node.hasAttribute("data-language")) {
          element.dataset.language = node.getAttribute("data-language");
        }
        if ((node.tagName === "A" || node.tagName === "IMG") && node.hasAttribute("title")) {
          element.title = node.getAttribute("title");
        }
        for (const child of node.childNodes) element.appendChild(copy(child));
        return element;
      }

      return Array.from(parsed.body.childNodes, copy);
    }

    function update() {
      const markdown = editor.value;
      preview.replaceChildren(...safePreviewNodes(renderMarkdown(markdown)));
      const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
      wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
    }

    function setStatus(message) {
      status.textContent = message;
      window.clearTimeout(setStatus.timer);
      setStatus.timer = window.setTimeout(() => {
        status.textContent = "Ready";
      }, 2200);
    }

    async function loadFile(file) {
      if (!file) return;
      const text = await file.text();
      editor.value = text;
      setLoadedFileName(file.name);
      update();
      setStatus(`Loaded ${file.name}`);
    }

    fileInput.addEventListener("change", event => {
      loadFile(event.target.files[0]);
      event.target.value = "";
    });

    editor.addEventListener("input", update);

    previewOnly.addEventListener("click", () => {
      const pressed = previewOnly.getAttribute("aria-pressed") === "true";
      previewOnly.setAttribute("aria-pressed", String(!pressed));
      editorPane.classList.toggle("hidden", !pressed);
      main.classList.toggle("preview-only", !pressed);
    });

    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.left = "-9999px";
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand("copy");
      scratch.remove();
    }

    copyHtml.addEventListener("click", async () => {
      await copyText(preview.innerHTML);
      setStatus("Rendered HTML copied");
    });

    downloadHtml.addEventListener("click", () => {
      const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Markdown Export</title><style>table { width: 100%; border-collapse: collapse; }</style></head><body>${preview.innerHTML}</body></html>`;
      const blob = new Blob([documentHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "markdown-export.html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Exported HTML");
    });

    exportPdf.addEventListener("click", () => {
      update();
      document.title = fileStem(fileName.textContent);
      setStatus("Turn off Headers and footers, then Save as PDF");
      window.print();
    });

    document.addEventListener("dragover", event => {
      event.preventDefault();
      document.body.classList.add("drop-active");
    });

    document.addEventListener("dragleave", event => {
      if (event.target === document || event.clientX <= 0 || event.clientY <= 0) {
        document.body.classList.remove("drop-active");
      }
    });

    document.addEventListener("drop", event => {
      event.preventDefault();
      document.body.classList.remove("drop-active");
      loadFile(event.dataTransfer.files[0]);
    });

    async function loadContextInput() {
      const key = new URL(location.href).searchParams.get("input");
      if (!key || !/^[0-9a-f-]{36}$/.test(key)) return;
      const stored = await browser.storage.local.get(key);
      await browser.storage.local.remove(key);
      const input = stored[key];
      if (!input) return;
      if (typeof input.content === "string") {
        editor.value = input.content;
        setLoadedFileName(input.name);
        update();
        return;
      }
      if (typeof input.url !== "string") return;
      try {
        const url = new URL(input.url);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Unsupported link");
        const response = await fetch(url.href, { credentials: "omit" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (Number(response.headers.get("content-length")) > 2_000_000) throw new Error("File exceeds 2 MB");
        const content = await response.text();
        if (content.length > 2_000_000) throw new Error("File exceeds 2 MB");
        editor.value = content;
        setLoadedFileName(input.name);
        update();
      } catch (error) {
        setStatus(`Could not load link: ${error.message}`);
      }
    }

    update();
    loadContextInput();
