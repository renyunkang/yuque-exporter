import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { autoLogin } from './src/login.js';
import { getAllBooks } from './src/toc.js';
import { exportMarkDownFiles } from './src/export.js';
import { verifyExportedFiles } from './src/verify.js';
// import { printDirectoryTree } from './src/toc.js';


let color = {
    byNum: (mess, fgNum) => {
        mess = mess || '';
        fgNum = fgNum === undefined ? 31 : fgNum;
        return '\u001b[' + fgNum + 'm' + mess + '\u001b[39m';
    },
    black: (mess) => color.byNum(mess, 30),
    red: (mess) => color.byNum(mess, 31),
    green: (mess) => color.byNum(mess, 32),
    yellow: (mess) => color.byNum(mess, 33),
    blue: (mess) => color.byNum(mess, 34),
    magenta: (mess) => color.byNum(mess, 35),
    cyan: (mess) => color.byNum(mess, 36),
    white: (mess) => color.byNum(mess, 37)
};

function getBrowserCandidates() {
    return [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        process.env.EDGE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
    ].filter(Boolean);
}

function resolveExecutablePath() {
    for (const executablePath of getBrowserCandidates()) {
        if (fs.existsSync(executablePath)) {
            return executablePath;
        }
    }

    return null;
}

function getLaunchOptions() {
    const executablePath = resolveExecutablePath();
    const headless = process.env.HEADLESS === 'false' ? false : 'new';
    const launchOptions = {
        headless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--disable-blink-features=AutomationControlled'
        ]
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
        console.log(`Use browser executable: ${executablePath}`);
    } else {
        console.log(color.yellow('No local Chromium-based browser was detected. Puppeteer will try to use its bundled Chromium if it is installed.'));
    }

    console.log(`Use headless mode: ${headless}`);

    return launchOptions;
}

async function preparePage(page) {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        Object.defineProperty(navigator, 'languages', {
            get: () => ['zh-CN', 'zh', 'en']
        });

        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        window.chrome = window.chrome || {
            runtime: {}
        };

        const originalQuery = window.navigator.permissions?.query;
        if (originalQuery) {
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters)
            );
        }
    });
}

async function run() {
    const verifyOnly = process.env.VERIFY_ONLY === 'true';

    if (!process.env.EXPORT_PATH) {
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        process.env.EXPORT_PATH = outputDir;
        console.log(`The environment variable EXPORT_PATH is not set, so the default ${outputDir} is used as the export path.`)
    }

    // const page = await BrowserPage.getInstance();
    const browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    await preparePage(page);

    // 检查是否存在 cookie 文件
    await autoLogin(page)
    console.log(color.green("Login successfully!"))
    console.log()

    console.log("Get book stacks ...")
    const books = await getAllBooks(page)
    // console.log(books)

    console.log("Start export all books ...")
    if (verifyOnly) {
        console.log('VERIFY_ONLY=true, skip export and verify local markdown files only.');
    } else {
        await exportMarkDownFiles(page, books)
    }

    console.log('Start verifying exported markdown files ...');
    const verification = verifyExportedFiles(process.env.EXPORT_PATH, books);
    if (verification.missingFiles.length > 0) {
        console.log(color.yellow(`Missing markdown files count: ${verification.missingFiles.length}`));
    } else {
        console.log(color.green('All markdown files are present.'));
    }

    await browser.close()
};


run();

