import fs from 'fs';
import path from 'path';
import { type } from './const.js';

// Function to sanitize filename for filesystem compatibility
function sanitizeFilename(filename, index = '') {
    const cleaned = filename
        .replace(/[\r\n\t]/g, '') // Remove line breaks and tabs
        .replace(/[\/\\:*?"<>|]/g, '_') // Replace invalid characters with underscore
        .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
        .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '') // Keep only printable ASCII and CJK characters
        .trim() // Remove leading/trailing whitespace
        .substring(0, 25) // Limit length to 25 characters to leave room for index
        .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
        || 'unnamed_document'; // Fallback name if empty after sanitization
    
    // Add index if provided to avoid duplicates
    return index ? `${cleaned}_${index}` : cleaned;
}

// Global progress tracking
const progressTracker = {
    // Book level tracking
    currentBook: '',
    currentDocument: '',
    totalBooks: 0,
    completedBooks: 0,
    skippedBooks: 0,
    
    // Document level tracking
    totalDocuments: 0,
    completedDocuments: 0,
    skippedDocuments: 0,
    failedDocuments: [],
    
    // Current book progress
    currentBookProgress: { current: 0, total: 0 },
    
    // Statistics
    startTime: null,
    
    init() {
        this.startTime = Date.now();
    },
    
    getElapsedTime() {
        if (!this.startTime) return '00:00:00';
        const elapsed = Date.now() - this.startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
    
    getETA() {
        if (!this.startTime || this.completedDocuments === 0) return 'Calculating...';
        const elapsed = Date.now() - this.startTime;
        const avgTimePerDoc = elapsed / this.completedDocuments;
        const remainingDocs = this.totalDocuments - this.completedDocuments - this.skippedDocuments - this.failedDocuments.length;
        if (remainingDocs <= 0) return 'Complete!';
        
        const etaMs = remainingDocs * avgTimePerDoc;
        const hours = Math.floor(etaMs / 3600000);
        const minutes = Math.floor((etaMs % 3600000) / 60000);
        const seconds = Math.floor((etaMs % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
    
    displayProgress() {
        const totalProgress = ((this.completedBooks + this.skippedBooks) / this.totalBooks * 100).toFixed(1);
        const docProgress = this.totalDocuments > 0 ? 
            ((this.completedDocuments + this.skippedDocuments + this.failedDocuments.length) / this.totalDocuments * 100).toFixed(1) : 0;
        const bookProgress = this.currentBookProgress.total > 0 ? 
            (this.currentBookProgress.current / this.currentBookProgress.total * 100).toFixed(1) : 0;
        
        console.clear(); // Clear screen for better display
        console.log('\n' + '='.repeat(100));
        console.log(`📊 YUQUE EXPORT PROGRESS DASHBOARD`);
        console.log('='.repeat(100));
        
        // Time statistics
        console.log(`⏱️  Runtime: ${this.getElapsedTime()} | ETA: ${this.getETA()}`);
        console.log('');
        
        // Overall progress
        console.log(`📈 OVERALL PROGRESS`);
        console.log(`   📚 Books: ${this.completedBooks + this.skippedBooks}/${this.totalBooks} (${totalProgress}%)`);
        console.log(`   📄 Documents: ${this.completedDocuments + this.skippedDocuments + this.failedDocuments.length}/${this.totalDocuments} (${docProgress}%)`);
        console.log('');
        
        // Current status
        console.log(`🎯 CURRENT STATUS`);
        console.log(`   📚 Processing Book: ${this.currentBook}`);
        console.log(`   📄 Current Document: ${this.currentDocument}`);
        if (this.currentBookProgress.total > 0) {
            console.log(`   📊 Book Progress: ${this.currentBookProgress.current}/${this.currentBookProgress.total} (${bookProgress}%)`);
        }
        console.log('');
        
        // Success statistics
        console.log(`✅ SUCCESS STATISTICS`);
        console.log(`   📚 Completed Books: ${this.completedBooks}`);
        console.log(`   📄 Downloaded Documents: ${this.completedDocuments}`);
        console.log(`   ⏭️  Skipped (Existing): ${this.skippedDocuments}`);
        console.log('');
        
        // Error statistics
        if (this.failedDocuments.length > 0) {
            console.log(`❌ ERROR STATISTICS`);
            console.log(`   🚨 Failed Downloads: ${this.failedDocuments.length}`);
            console.log(`   📋 Error Details:`);
            this.failedDocuments.slice(-5).forEach((doc, index) => {
                console.log(`      ${index + 1}. ${doc.book}/${doc.document}`);
                console.log(`         📝 Reason: ${doc.reason}`);
                console.log(`         🕐 Time: ${doc.timestamp}`);
            });
            if (this.failedDocuments.length > 5) {
                console.log(`      ... and ${this.failedDocuments.length - 5} more errors`);
            }
            console.log('');
        }
        
        console.log('='.repeat(100));
    },
    
    displayFinalSummary() {
        console.clear();
        console.log('\n' + '='.repeat(100));
        console.log(`🎉 YUQUE EXPORT COMPLETE - FINAL SUMMARY`);
        console.log('='.repeat(100));
        
        console.log(`⏱️  Total Runtime: ${this.getElapsedTime()}`);
        console.log('');
        
        console.log(`📊 FINAL STATISTICS:`);
        console.log(`   📚 Total Books: ${this.totalBooks}`);
        console.log(`   📄 Total Documents: ${this.totalDocuments}`);
        console.log('');
        
        console.log(`✅ SUCCESS:`);
        console.log(`   📚 Completed Books: ${this.completedBooks}`);
        console.log(`   📄 Downloaded Documents: ${this.completedDocuments}`);
        console.log(`   ⏭️  Skipped (Existing): ${this.skippedDocuments}`);
        console.log('');
        
        if (this.skippedBooks > 0) {
            console.log(`⏭️  SKIPPED:`);
            console.log(`   📚 Skipped Books (Existing): ${this.skippedBooks}`);
            console.log('');
        }
        
        if (this.failedDocuments.length > 0) {
            console.log(`❌ ERRORS:`);
            console.log(`   🚨 Failed Downloads: ${this.failedDocuments.length}`);
            console.log(`   📋 Complete Error Log:`);
            this.failedDocuments.forEach((doc, index) => {
                console.log(`      ${index + 1}. ${doc.book}/${doc.document}`);
                console.log(`         📝 Reason: ${doc.reason}`);
                console.log(`         🕐 Time: ${doc.timestamp}`);
            });
            console.log('');
        }
        
        const successRate = this.totalDocuments > 0 ? 
            ((this.completedDocuments + this.skippedDocuments) / this.totalDocuments * 100).toFixed(1) : 0;
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log('='.repeat(100));
        console.log('');
    }
};

export async function exportMarkDownFiles(page, books) {
    const folderPath = process.env.EXPORT_PATH;
    console.log("download folderPath: " + folderPath)
    if (!fs.existsSync(folderPath)) {
        console.error(`export path:${folderPath} is not exist`)
        process.exit(1)
    }

    // Initialize progress tracker
    progressTracker.init();
    progressTracker.totalBooks = books.length;
    
    // Count total documents across all books
    progressTracker.totalDocuments = books.reduce((total, book) => {
        return total + countDocuments(book.root);
    }, 0);
    
    console.log(`\n📊 EXPORT INITIALIZATION`);
    console.log(`📚 Total Books to Process: ${progressTracker.totalBooks}`);
    console.log(`📄 Total Documents to Export: ${progressTracker.totalDocuments}`);
    console.log(`🚀 Starting export process...\n`);
    
    // Get existing directories to skip
    const existingDirs = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    console.log(`Found ${existingDirs.length} existing directories: [${existingDirs.join(', ')}]`);

    // console.log(books)
    for ( let i = 0; i < books.length; i++ ) {
        const bookName = books[i].name;
        progressTracker.currentBook = bookName;
        progressTracker.currentDocument = 'Initializing...';
        
        if (existingDirs.includes(bookName)) {
            console.log(`⏭️  Skipping existing directory: ${bookName} (${i + 1}/${books.length})`);
            progressTracker.skippedBooks++;
            // Count skipped documents
            const skippedDocCount = countDocuments(books[i].root);
            progressTracker.skippedDocuments += skippedDocCount;
            progressTracker.displayProgress();
            continue;
        }
        
        console.log(`📁 Processing book: ${bookName} (${i + 1}/${books.length})`);
        
        // Count documents in this book
        const docCount = countDocuments(books[i].root);
        progressTracker.currentBookProgress = { current: 0, total: docCount };
        
        await exportMarkDownFileTree(page, folderPath, books[i], books[i].root);
        
        progressTracker.completedBooks++;
        progressTracker.currentDocument = 'Completed';
        progressTracker.displayProgress();
        console.log();
    }

    progressTracker.displayFinalSummary();
    console.log(`🎉 Export process completed! Have a good day!`);
}

// Function to count total documents in a book tree
function countDocuments(node) {
    let count = 0;
    
    if (node.type === type.Document || node.type === type.TitleDoc) {
        count = 1;
    }
    
    if (node.children) {
        for (const child of node.children) {
            count += countDocuments(child);
        }
    }
    
    return count;
}


async function exportMarkDownFileTree(page, folderPath, book, node) {
    switch (node.type) {
        case type.Book: 
            folderPath = path.join(folderPath, book.name);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath)
            }
            break;
        case type.Title: 
            folderPath = path.join(folderPath, node.name);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath)
            }
            break;
        case type.TitleDoc: 
            folderPath = path.join(folderPath, node.name);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath)
            }
        case type.Document: 
            const client = await page.target().createCDPSession()
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: folderPath,
            })
            // Update progress tracker
            progressTracker.currentDocument = node.name;
            progressTracker.currentBookProgress.current++;
            
            // Clean filename to handle special characters and length limits
            const cleanedName = sanitizeFilename(node.name);
            
            try {
                await downloadMardown(page, folderPath, book.name, cleanedName,
                    book.user_url + "/" + book.slug + "/" + node.object.url)
            } catch (error) {
                // Document download failed, add to failed list
                const timestamp = new Date().toLocaleString();
                progressTracker.failedDocuments.push({
                    book: book.name,
                    document: node.name,
                    reason: error.message || 'Unknown error',
                    timestamp: timestamp
                });
                console.log(`❌ FAILED: ${book.name}/${node.name} - ${error.message}`);
            }
            break;
    }

    if (node.children) {
        for (const childNode of node.children) {
            await exportMarkDownFileTree(page, folderPath, book, childNode);
        }
    }
}


// browserpage, bookName, url
async function downloadMardown(page, rootPath, book, mdname, docUrl) {
    const url = 'https://www.yuque.com/' + docUrl + '/markdown?attachment=true&latexcode=false&anchor=false&linebreak=false';
    // console.log(book + "/" + mdname + "'s download URL is: " + url)
    // console.log(rootPath)

    await downloadFile(page, rootPath, book, mdname, url)
    // await page.waitForTimeout(1000);
}

async function downloadFile(page, rootPath, book, mdname, url, maxRetries = 3) {
    var retries = 0;

    async function downloadWithRetries() {
        try {
            await goto(page, url);
            console.log(`📥 Downloading: ${book}/${mdname}`);
            const fileNameWithExt = await waitForDownload(rootPath, book, mdname);
            const fileName = path.basename(fileNameWithExt, path.extname(fileNameWithExt));
            console.log(`✅ Downloaded: ${book}/${fileName}`);
            progressTracker.completedDocuments++;
            progressTracker.displayProgress();
        } catch (error) {
            console.log(`❌ Error: ${error}`);
            if (retries < maxRetries) {
                console.log(`🔄 Retrying download... (attempt ${retries + 1}/${maxRetries})`);
                retries++;
                await downloadWithRetries();
            } else {
                const errorMsg = `Download failed after ${maxRetries} retries: ${error.message}`;
                console.log(`❌ ${errorMsg} - SKIPPING`);
                
                // Add to failed documents list
                const timestamp = new Date().toLocaleString();
                progressTracker.failedDocuments.push({
                    book: book,
                    document: mdname,
                    reason: error.message || 'Download timeout',
                    timestamp: timestamp
                });
                
                throw error; // Re-throw to be caught by exportMarkDownFileTree
            }
        }
    }

    await downloadWithRetries();
}

async function goto(page, link) {
    page.evaluate((link) => {
        location.href = link;
    }, link);
}
  
async function waitForDownload(rootPath, book, mdname, started = false) {
    const timeout = 120000; // 120s timeout (increased to handle slow downloads and problematic files)
    return new Promise((resolve, reject) => {
        console.log(`Monitoring download: ${rootPath}/${mdname}.md`);
        const watcher = fs.watch(rootPath, (eventType, filename) => {
            console.log(`File event: ${eventType} -> ${filename || 'undefined'}`);
            
            if (eventType === 'rename' && filename === `${mdname}.md.crdownload` && !started) {
                console.log("✅ Download started: " + book + "/" + mdname)
                started = true
            }

            if (eventType === 'rename' && filename === `${mdname}.md`) {
                console.log("✅ Download completed: " + book + "/" + mdname);
                watcher.close();
                resolve(filename);
            }
        });

        // Check if file already exists (in case download was very fast)
        const targetFile = path.join(rootPath, `${mdname}.md`);
        const checkExisting = setInterval(() => {
            if (fs.existsSync(targetFile)) {
                console.log("✅ File already exists: " + book + "/" + mdname);
                progressTracker.skippedDocuments++;
                clearInterval(checkExisting);
                watcher.close();
                resolve(`${mdname}.md`);
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(checkExisting);
            watcher.close();
            
            // Final check if file exists before rejecting
            if (fs.existsSync(targetFile)) {
                console.log("✅ File found on timeout check: " + book + "/" + mdname);
                resolve(`${mdname}.md`);
            } else {
                reject(new Error('Download timed out'));
            }
        }, timeout);
    });
}