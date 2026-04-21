# Repository Guidelines

## Project Structure & Module Organization
`main.js` is the Node entry point for browser-driven Yuque export. Core modules live in `src/`: `login.js` handles authentication, `toc.js` builds the book tree, `export.js` writes Markdown output, and `const.js` stores shared constants. `export-image.py` is a separate Python helper for downloading images and rewriting Markdown image links. Static screenshots and demo assets live in `images/`. Exported content is written to `output/` by default at runtime and should not be committed.

## Build, Test, and Development Commands
Install dependencies with `npm install` or `yarn`. Run the exporter with `node main.js`; set `USER`, `PASSWORD`, and optionally `EXPORT_PATH` before starting. Run the image post-processor with `python export-image.py`; it reads `MARKDOWN_DIR`, `DOWNLOAD_IMAGE`, `UPDATE_MDIMG_URL`, and `REPLACE_IMAGE_HOST`. Example:

```powershell
$env:USER="name"; $env:PASSWORD="secret"; node .\main.js
$env:MARKDOWN_DIR=".\output"; python .\export-image.py
```

Chromium-based browsers must be available locally for Puppeteer.

## Coding Style & Naming Conventions
Follow the existing style: ES modules, semicolons, and 4-space indentation in JavaScript; standard PEP 8-style spacing in Python. Keep filenames lowercase and descriptive (`login.js`, `export-image.py`). Prefer small focused functions, keep environment-variable names uppercase, and avoid introducing framework tooling unless the repository already uses it.

## Testing Guidelines
There is no automated test framework or coverage gate configured today. Verify changes manually by running `node main.js` against a safe Yuque account or sample workspace, then validate generated Markdown and image rewriting in `output/`. If you add tests, keep them isolated, scriptable from the repo root, and document the command in `README.md` and this guide.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `remove redundant print`, `match latex link`, and `Update README.md`. Keep commits focused and one-purpose. Pull requests should include a concise summary, the behavior changed, manual verification steps, and screenshots or sample exported files when output formatting changes.

## Security & Configuration Tips
Do not commit credentials, cookies, or exported private content. Pass secrets through environment variables only, and keep temporary export directories out of version control.
