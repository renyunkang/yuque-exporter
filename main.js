import puppeteer from 'puppeteer';
import fs from 'fs';
import JSONStream from 'JSONStream';
import { Readable } from 'stream';
import { exit } from 'process';
import path from 'path';


class BookPage {
  constructor(id, name, slug) {
    this.id = id;
    this.name = name;
    this.slug = slug
  }
}

class Book {
  pages
  pageLength
  constructor(id, name, slug) {
    this.id = id;
    this.name = name;
    this.slug = slug
  }
}


if (!process.env.ACCESSURL) {
  console.log('env var: ACCESSURL required')
  process.exit(1);
}


if (!process.env.EXPORT_PATH) {
  console.log('env var: EXPORT_PATH required')
  process.exit(1);
}

(async () => {
  // const page = await BrowserPage.getInstance();
  const browser = await puppeteer.launch({ headless: true }); // true:not show browser
  const page = await browser.newPage();

  // 检查是否存在 cookie 文件
  const cookieFile = './cookies.json';
  let cookies = [];
  if (fs.existsSync(cookieFile)) {
      const cookiesString = fs.readFileSync(cookieFile);
      cookies = JSON.parse(cookiesString);
  }

  // 如果存在 cookie，则直接加载
  if (cookies.length > 0) {
    console.log("Login use cookies...")
    await page.setCookie(...cookies);
    await page.goto('https://www.yuque.com/dashboard');
  } else {
    console.log("Login use user + password...")
    if (!process.env.USER) {
      console.log('no cookie so use env var: USER required')
      process.exit(1);
    }
    
    if (!process.env.PASSWORD) {
      console.log('no cookie so use env var: PASSWORD required')
      process.exit(1);
    }

    await page.goto('https://www.yuque.com/login');
    // Switch to password login
    await page.click('.switch-btn');

    // Fill in phone number and password
    await page.type('input[data-testid=prefix-phone-input]', process.env.USER);
    await page.type('input[data-testid=loginPasswordInput]', process.env.PASSWORD);

    // Check agreement checkbox
    await page.click('input[data-testid=protocolCheckBox]');

    // Click login button
    await page.click('button[data-testid=btnLogin]');

    // 等待页面跳转完成
    await page.waitForNavigation();

    // 保存 cookie 到本地文件
    cookies = await page.cookies();
    fs.writeFileSync(cookieFile, JSON.stringify(cookies));
    
    console.log("Save cookie to cookies.json")
  }
  console.log("Login successfully!")
  console.log()

  
  // await page.goto('https://www.yuque.com/dashboard/books');
  // // 获取所有知识库元素
  // await page.waitForSelector('div[data-type="Book"]', { waitUntil: 'networkidle0' });
  // const books = await page.$$eval('div[data-type="Book"] .book-name-text', elements => elements.map(element => element.textContent));
  // const links = await page.$$eval('div[data-type="Book"] a[data-testid="adapter-link"]', elements => elements.map(element => element.getAttribute('href')));

  // // 打印每个知识库的标题
  // console.log("知识库的数量为：" + books.length);

  // for  (let i = 0; i < books.length; i++) {
  //   console.log(books[i]);
  //   console.log(links[i]);
  // }


  console.log("Get book stacks ...")
  var books = [];
  const response = await page.goto('https://www.yuque.com/api/mine/book_stacks', { waitUntil: 'networkidle0' });
  const bookListData = await response.text();
  
  const stream = new Readable({
    read() {
      this.push(bookListData);
      this.push(null); // stream end
    }
  });
  const parser = JSONStream.parse('data.*');
  stream.pipe(parser);
  parser.on('data', function(object) {
    for ( let i = 0; i < object.books.length; i++ ) {
      books.push(new Book(object.books[i].id, object.books[i].name, object.books[i].slug))
    }
  });


  await new Promise(resolve => {
    parser.on('end', async () => {
      console.log(`Books count is: ${books.length}`)
      var bookPages = [];
      for ( let i = 0; i < books.length; i++ ) {
        bookPages[i] = [];
        var bookUrl = 'https://www.yuque.com/api/docs?book_id=' + books[i].id
        var bookResponse = await page.goto(bookUrl, { waitUntil: 'networkidle0' });
        var pageListData = await bookResponse.text();
        var bookStream = new Readable({
          read() {
            this.push(pageListData);
            this.push(null); // stream end
          }
        });
        var bookParser = JSONStream.parse('data.*');
        bookStream.pipe(bookParser);
        bookParser.on('data', (object) => {
          bookPages[i].push(new BookPage(object.id, object.title, object.slug))
        });

        bookParser.on('end', () => {
          console.log(`No.${i+1} Book's name: ${books[i].name}`)
          console.log(bookPages[i])
          console.log()
          books[i].pages = bookPages[i]
          books[i].pageLength = bookPages[i].length
          
          if (i === books.length - 1) {
            resolve();
          }
        });
      }
    });
  }).then(async () => {
    console.log()
    console.log("Start export all books ...")
    console.log()

    const folderPath = process.env.EXPORT_PATH;
    console.log("download folderPath: " + folderPath)
    if (!fs.existsSync(folderPath)) {
      console.error(`export path:${folderPath} is not exist`)
      process.exit(1)
    }
  
    const client = await page.target().createCDPSession()
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: folderPath,
    })

    for ( let i = 0; i < books.length; i++ ) {
      for (let j = 0; j < books[i].pages.length; j++ ) {
        console.log("Download document " + books[i].name + "/" + books[i].pages[j].name)
        await downloadMardown(page, folderPath, books[i].name, books[i].pages[j].name, process.env.ACCESSURL + "/" + books[i].slug + "/" + books[i].pages[j].slug)
        console.log();
      }
    }


    fs.readdir(folderPath, (err, files) => {
      if (err) throw err;

      files.forEach((file) => {
        const filePath = path.join(folderPath, file);
        fs.stat(filePath, (err, stat) => {
          if (err) throw err;

          if (stat.isFile()) {    
            fs.unlink(filePath, (err) => {
              if (err) throw err;
            });
          }
        });
      });
      
    console.log()
    console.log(`Clean useless files successfully`);
    console.log()
    console.log(`Export successfully! Have a good day!`);
    console.log()
    });
  });

  browser.close()
})();


// browserpage, bookName, url
async function downloadMardown(page, rootPath, book, mdname, docUrl) {
  const url = 'https://www.yuque.com/' + docUrl + '/markdown?attachment=true&latexcode=false&anchor=false&linebreak=false';
  const timeout = 10000; // 10s timeout
  const maxRetries = 3; // max retry count

  const newPath = path.join(rootPath, book);
  if (!fs.existsSync(newPath)) {
    fs.mkdirSync(newPath)
  }

  async function goto(page, link) {
    return page.evaluate((link) => {
        location.href = link;
    }, link);
  }

  console.log("Download URL: " + url)
  await goto(page, url);

  async function waitForDownload() {
    return new Promise((resolve, reject) => {
      const watcher = fs.watch(rootPath, (eventType, filename) => {
        if (eventType === 'rename' && filename.endsWith('.md')) {
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

  async function downloadFile(recount = 0, retries = 0) {
    var count = recount
    try {
      const filename = await waitForDownload();
      const oldFiles = path.join(rootPath, filename);
      var newFiles = path.join(newPath, mdname.replace(/\//g, '-') + '.md');
      while (fs.existsSync(newFiles)) {
        count++;
        newFiles = path.join(newPath, mdname.replace(/\//g, '-') + `(${count}).md`);
      }

      // console.log(`oldFiles:${oldFiles} and newFiles:${newFiles}`);
      fs.renameSync(oldFiles, newFiles);
      console.log('Moved file to:', newFiles);
    } catch (error) {
      console.log(error);
      if (error.message === 'Download timed out' && retries < maxRetries) {
        console.log(`Retrying download... (attempt ${retries + 1})`);
        await goto(page, url);
        await downloadFile(count, retries + 1);
      } else {
        console.log(`Download error: ` + error);
      }
    }
  }

  await downloadFile()
}


