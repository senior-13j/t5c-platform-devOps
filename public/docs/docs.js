const documents = [
    { file: "README.md", title: "Documentation Home" },
    { file: "PROJECT.md", title: "Project Overview" },
    { file: "LOCALIZATION_AND_CONTROLS.md", title: "Localization and Controls" },
    { file: "API_AND_SECURITY.md", title: "API and Security" },
    { file: "GAME_QUALITY_AUDIT.md", title: "Game Quality Audit" },
    { file: "INFRASTRUCTURE_AND_DEPLOYMENT.md", title: "Infrastructure and Deployment" },
    { file: "PUBLIC_DEPLOYMENT.md", title: "Public Deployment" },
];

const content = document.getElementById("content");
const pageTitle = document.getElementById("page-title");
const navButtons = Array.from(document.querySelectorAll("[data-doc]"));
let activeLoadRequest = 0;

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderInline(value) {
    let rendered = escapeHtml(value);
    rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return rendered;
}

function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines, start) {
    const rows = [];
    let index = start;

    while (index < lines.length && lines[index].includes("|") && lines[index].trim() !== "") {
        rows.push(lines[index]);
        index += 1;
    }

    if (rows.length < 2 || !isTableSeparator(rows[1])) {
        return null;
    }

    const cells = (row) =>
        row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => renderInline(cell.trim()));

    const header = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    const html = [
        '<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0">',
        "<table>",
        "<thead><tr>",
        ...header.map((cell) => `<th>${cell}</th>`),
        "</tr></thead>",
        "<tbody>",
        ...body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`),
        "</tbody></table></div>",
    ].join("");

    return { html, next: index };
}

function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r/g, "").split("\n");
    const html = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];

        if (line.trim() === "") {
            index += 1;
            continue;
        }

        if (line.startsWith("```")) {
            const language = line.replace(/^```/, "").trim();
            const code = [];
            index += 1;
            while (index < lines.length && !lines[index].startsWith("```")) {
                code.push(lines[index]);
                index += 1;
            }
            index += 1;
            html.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code.join("\n"))}</code></pre>`);
            continue;
        }

        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const text = renderInline(heading[2].trim());
            html.push(`<h${level}>${text}</h${level}>`);
            index += 1;
            continue;
        }

        if (/^\s*---+\s*$/.test(line)) {
            html.push("<hr />");
            index += 1;
            continue;
        }

        const table = parseTable(lines, index);
        if (table) {
            html.push(table.html);
            index = table.next;
            continue;
        }

        if (/^\s*-\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
                items.push(`<li>${renderInline(lines[index].replace(/^\s*-\s+/, ""))}</li>`);
                index += 1;
            }
            html.push(`<ul>${items.join("")}</ul>`);
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+\.\s+/, ""))}</li>`);
                index += 1;
            }
            html.push(`<ol>${items.join("")}</ol>`);
            continue;
        }

        if (/^\s*>\s+/.test(line)) {
            const quotes = [];
            while (index < lines.length && /^\s*>\s+/.test(lines[index])) {
                quotes.push(renderInline(lines[index].replace(/^\s*>\s+/, "")));
                index += 1;
            }
            html.push(`<blockquote>${quotes.join("<br />")}</blockquote>`);
            continue;
        }

        const paragraph = [];
        while (
            index < lines.length &&
            lines[index].trim() !== "" &&
            !lines[index].startsWith("```") &&
            !/^(#{1,4})\s+/.test(lines[index]) &&
            !/^\s*-\s+/.test(lines[index]) &&
            !/^\s*\d+\.\s+/.test(lines[index]) &&
            !/^\s*>\s+/.test(lines[index])
        ) {
            paragraph.push(lines[index]);
            index += 1;
        }
        html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return html.join("\n");
}

async function loadDocument(file) {
    const requestId = ++activeLoadRequest;
    const selected = documents.find((doc) => doc.file === file) || documents[0];
    pageTitle.textContent = selected.title;
    navButtons.forEach((button) => {
        const isActive = button.dataset.doc === selected.file;
        button.classList.toggle("active", isActive);
        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
    content.innerHTML = `<p role="status">Loading ${escapeHtml(selected.title)}...</p>`;

    try {
        const response = await fetch(`./content/${selected.file}`, { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const markdown = await response.text();
        if (requestId !== activeLoadRequest) {
            return;
        }
        content.innerHTML = renderMarkdown(markdown);
        history.replaceState(null, "", `#${selected.file.replace(/\.md$/, "").toLowerCase()}`);
    } catch (error) {
        if (requestId !== activeLoadRequest) {
            return;
        }
        content.innerHTML = `<p class="error">Could not load ${escapeHtml(selected.file)}: ${escapeHtml(error.message)}</p>`;
    }
}

navButtons.forEach((button) => {
    button.addEventListener("click", () => loadDocument(button.dataset.doc));
});

content.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) {
        return;
    }

    const href = link.getAttribute("href") || "";
    const markdownFile = href.match(/([^/#?]+\.md)(?:[#?].*)?$/);
    if (markdownFile) {
        event.preventDefault();
        loadDocument(markdownFile[1]);
        return;
    }

    if (href.startsWith("#")) {
        const id = href.replace(/^#/, "").toUpperCase();
        const doc = documents.find((item) => item.file.replace(/\.md$/, "") === id);
        if (doc) {
            event.preventDefault();
            loadDocument(doc.file);
        }
    }
});

const hash = window.location.hash.replace(/^#/, "").toUpperCase();
const initial = documents.find((doc) => doc.file.replace(/\.md$/, "") === hash);
loadDocument(initial ? initial.file : documents[0].file);
