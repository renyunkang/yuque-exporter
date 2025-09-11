# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Yuque document exporter tool that uses Puppeteer to automate browser interactions for bulk markdown export from Yuque knowledge bases. The tool simulates user actions to export documents one by one, maintaining directory structure and optionally downloading/processing images.

## Key Components

### Core Architecture
- `main.js` - Entry point that orchestrates the export process
- `src/login.js` - Handles authentication (cookie-based or credential-based)  
- `src/toc.js` - Fetches and processes knowledge base table of contents
- `src/export.js` - Downloads markdown files with retry logic
- `src/const.js` - Type definitions for document/folder hierarchy
- `export-image.py` - Python script for image processing and URL replacement

### Data Flow
1. Authentication via saved cookies or USER/PASSWORD environment variables
2. Fetch all accessible knowledge bases from Yuque API
3. Build hierarchical tree structure for each book using UUID relationships
4. Export documents following directory structure with retry mechanism
5. Optional image download and markdown link replacement via Python script

## Environment Variables

### Required for Node.js Export
- `USER` - Yuque username (required if no cookies.json exists)
- `PASSWORD` - Yuque password (required if no cookies.json exists)
- `EXPORT_PATH` - Output directory (optional, defaults to ./output)

### Optional for Python Image Processing  
- `MARKDOWN_DIR` - Markdown files location (defaults to ./output)
- `DOWNLOAD_IMAGE` - Whether to download images (default: "true")
- `UPDATE_MDIMG_URL` - Whether to update image URLs in markdown (default: "false")
- `REPLACE_IMAGE_HOST` - Custom domain for image URLs (optional)

## Development Commands

### Setup and Installation
```bash
npm install --registry=https://registry.npm.taobao.org
```

### Running the Exporter
```bash
# First run with credentials
USER=username PASSWORD=password node main.js

# Subsequent runs with saved cookies  
node main.js

# With custom export path
EXPORT_PATH=/path/to/output node main.js
```

### Image Processing
```bash
# Download images only
python export-image.py

# Update markdown links to relative paths
DOWNLOAD_IMAGE=false UPDATE_MDIMG_URL=true python export-image.py

# Update links to custom domain
DOWNLOAD_IMAGE=false UPDATE_MDIMG_URL=true REPLACE_IMAGE_HOST=https://your-domain.com python export-image.py
```

## Technical Implementation Details

### Authentication Strategy
- First run requires USER/PASSWORD and saves cookies to cookies.json
- Subsequent runs automatically use saved cookies for faster authentication
- Includes CAPTCHA handling via mouse drag simulation

### Tree Building Algorithm
- Fetches catalog nodes via Yuque API with UUID-based relationships
- Uses parent_uuid, child_uuid, sibling_uuid to build hierarchical structure  
- Distinguishes between Title (folder), Document (file), and TitleDoc (folder+file) types

### Export Process
- Uses Puppeteer CDP (Chrome DevTools Protocol) for download control
- Implements retry logic (default 3 attempts) for failed downloads
- Monitors filesystem events to detect download completion
- Maintains original directory structure in export

### Error Handling
- Timeout handling for document downloads (10s default)
- Retry mechanism with exponential backoff for failed exports
- File system monitoring for download state tracking
- Browser path fallback for different operating systems

## File Naming and Structure

The tool sanitizes filenames by replacing problematic characters:
- `/` → `_`  
- `"` → `_`
- `:` → `_`
- `?` → `_`
- Other invalid filesystem characters are removed

Export structure follows Yuque hierarchy:
```
output/
├── Book1/
│   ├── Chapter1/
│   │   └── document1.md
│   └── document2.md
└── Book2/
    └── document3.md
```

## Browser Configuration

Default Puppeteer configuration includes:
- `--no-sandbox` and `--disable-setuid-sandbox` flags for Linux compatibility
- Headless mode enabled (set `headless: false` for debugging)
- Custom executable path may need adjustment for different systems

Common browser paths:
- Windows: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Linux: `/usr/bin/google-chrome`