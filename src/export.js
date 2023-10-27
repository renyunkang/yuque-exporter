import fs from 'fs';
import path from 'path';
import { type } from './const.js';

export async function exportMarkDownFiles(page, books) {
    const folderPath = process.env.EXPORT_PATH;
    console.log("download folderPath: " + folderPath)
    if (!fs.existsSync(folderPath)) {
        console.error(`export path:${folderPath} is not exist`)
        process.exit(1)
    }

    // console.log(books)
    for ( let i = 0; i < books.length; i++ ) {
        await exportMarkDownFileTree(page, folderPath, books[i], books[i].root)
        console.log();
    }

    console.log(`=====> Export successfully! Have a good day!`);
    console.log();
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
            await downloadMardown(page, folderPath, book.name, node.name.replace(/\//g, '_'),
                process.env.ACCESSURL + "/" + book.slug + "/" + node.object.url)
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
            console.log(`Waiting download document to ${rootPath}\\${mdname}`);
            const fileNameWithExt = await waitForDownload(rootPath, book, mdname);
            const fileName = path.basename(fileNameWithExt, path.extname(fileNameWithExt));
            console.log("Download document " + book + "/" + fileName + " finished");
            console.log();
        } catch (error) {
            console.log(error);
            if (retries < maxRetries) {
                console.log(`Retrying download... (attempt ${retries + 1})`);
                retries++;
                await downloadWithRetries();
            } else {
                console.log(`Download error after ${maxRetries} retries: ${error}`);
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
    const timeout = 10000; // 10s timeout
    return new Promise((resolve, reject) => {
        // console.log(`======> watch ${rootPath} ${mdname}.md`)
        const watcher = fs.watch(rootPath, (eventType, filename) => {
            // console.log(`watch ${rootPath} ${eventType} ${filename}, want ${mdname}.md`)
            if (eventType === 'rename' && filename === `${mdname}.md.crdownload` && !started) {
                console.log("Downloading document " + book + "/" + mdname)
                started = true
            }

            if (eventType === 'rename' && filename === `${mdname}.md` && started) {
                watcher.close();
                resolve(filename);
            }
        });

        setTimeout(() => {
            watcher.close();
            reject(new Error('Download timed out'));
        }, timeout);
    });
}