import fs from 'fs';
import path from 'path';
import { type } from './const.js';

export function verifyExportedFiles(exportPath, books) {
    const expectedFiles = collectExpectedMarkdownFiles(books);
    const actualFiles = collectActualMarkdownFiles(exportPath);
    const actualSet = new Set(actualFiles);
    const missingFiles = expectedFiles.filter((file) => !actualSet.has(file));

    console.log(`Expected markdown files: ${expectedFiles.length}`);
    console.log(`Actual markdown files: ${actualFiles.length}`);

    if (missingFiles.length === 0) {
        console.log('Verification passed: no markdown files are missing.');
        return { expectedFiles, actualFiles, missingFiles };
    }

    console.log(`Verification failed: ${missingFiles.length} markdown files are missing.`);
    for (const file of missingFiles) {
        console.log(`MISSING: ${file}`);
    }

    return { expectedFiles, actualFiles, missingFiles };
}

function collectExpectedMarkdownFiles(books) {
    const expectedFiles = [];

    for (const book of books) {
        const bookFolder = book.name;
        collectNodeExpectedFiles(book.root, bookFolder, expectedFiles);
    }

    return expectedFiles.sort();
}

function collectNodeExpectedFiles(node, currentPath, expectedFiles) {
    switch (node.type) {
        case type.Book:
            break;
        case type.Title:
            currentPath = path.join(currentPath, node.name);
            break;
        case type.TitleDoc:
            currentPath = path.join(currentPath, node.name);
            expectedFiles.push(normalizeRelativePath(path.join(currentPath, `${node.name}.md`)));
            break;
        case type.Document:
            expectedFiles.push(normalizeRelativePath(path.join(currentPath, `${node.name}.md`)));
            break;
    }

    if (!node.children) {
        return;
    }

    for (const childNode of node.children) {
        collectNodeExpectedFiles(childNode, currentPath, expectedFiles);
    }
}

function collectActualMarkdownFiles(rootPath) {
    if (!fs.existsSync(rootPath)) {
        return [];
    }

    const markdownFiles = [];
    walkDirectory(rootPath, rootPath, markdownFiles);
    return markdownFiles.sort();
}

function walkDirectory(rootPath, currentPath, markdownFiles) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            walkDirectory(rootPath, fullPath, markdownFiles);
            continue;
        }

        if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
            markdownFiles.push(normalizeRelativePath(path.relative(rootPath, fullPath)));
        }
    }
}

function normalizeRelativePath(filePath) {
    return filePath.split(path.sep).join('/');
}
