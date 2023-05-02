import puppeteer from 'puppeteer';
import fs from 'fs';
import JSONStream from 'JSONStream';
import { Readable } from 'stream';
import { exit } from 'process';
import path from 'path';


// class BrowserPage {
//   constructor(page) {
//     this.page = page;
//   }

//   static getInstance() {
//     if (!BrowserPage.instance) {
//       const browser = puppeteer.launch({ headless: false });
//       BrowserPage.instance = browser.newPage();
//     }
//     return BrowserPage.instance
//   }
// }


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


(async () => {
  // const page = await BrowserPage.getInstance();
  const browser = await puppeteer.launch({ headless: false });
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
    await page.setCookie(...cookies);
    await page.goto('https://www.yuque.com/dashboard');
    // 等待页面跳转完成
    // await page.waitForNavigation({waitUntil: 'networkidle0'});
  } else {
    if (!process.env.USER) {
      console.log('no cookie so use env var: USER required')
      process.exit(1);
    }
    
    if (!process.env.PASSWORD) {
      console.log('no cookie so use env var: PASSWORD required')
      process.exit(1);
    }

    // 否则，使用账号密码登录
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
  }

  
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


  var books = [];
  const response = await page.goto('https://www.yuque.com/api/mine/book_stacks', { waitUntil: 'networkidle0' });
  const bookListData = await response.text();
  // console.log(response.text());
  
  const stream = new Readable({
    read() {
      this.push(bookListData);
      this.push(null); // stream end
    }
  });
  const parser = JSONStream.parse('data.*'); // 使用JSONStream模块解析JSON
  stream.pipe(parser); // 将读取流通过管道传递给解析器
  parser.on('data', function(object) {
    for ( let i = 0; i < object.books.length; i++ ) {
      books.push(new Book(object.books[i].id, object.books[i].name, object.books[i].slug))
    }
  });


  await new Promise(resolve => {
    parser.on('end', async () => {
      var bookPages = [];
      for ( let i = 0; i < books.length; i++ ) {
        bookPages[i] = [];
        // console.log("init index = " + i)
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
          // console.log("deal index = " + i)
          bookPages[i].push(new BookPage(object.id, object.title, object.slug))
        });

        bookParser.on('end', () => {
          // console.log("end index = " + i)
          // console.log(bookPages[i])
          // console.log()
          books[i].pages = bookPages[i]
          books[i].pageLength = bookPages[i].length
          
          if (i === books.length - 1) {
            resolve();
          }
        });
      }
    });
  }).then(async () => {
    for ( let i = 0; i < 2; i++ ) { //books.length
      console.log("<==========>")
      console.log(books[i])
      for (let j = 0; j < books[i].pages.length; j++ ) {
        console.log("download page " + books[i].name + "/" + books[i].pages[j].name)
        await downloadMardown(page, books[i].name, books[i].pages[j].name, process.env.ACCESSURL + "/" + books[i].slug + "/" + books[i].pages[j].slug)
        console.log();
      }
    }
  });
  
  // then(() => {
  //   for ( let i = 0; i < books.length; i++ ) {
  //     console.log("<==========>")
  //     console.log(books[i])
  //     for (let j = 0; j < books[i].pages.length; j++ ) {
  //       console.log("download page " + books[i].pages[j].name)
  //       downloadMardown(page, books[i].name, "renyunkang/" + books[i].slug + "/" + books[i].pages[j].slug)
  //     }
  //   }
  // });


})();


// browserpage, bookName, url
async function downloadMardown(page, book, mdname, docUrl) {
  const url = 'https://www.yuque.com/' + docUrl + '/markdown?attachment=true&latexcode=false&anchor=false&linebreak=false';
  const folderPath = 'E:\\test\\yuque-test\\' + book;
  const timeout = 10000; // 30s timeout
  const maxRetries = 3; // max retry count
  
  console.log("download url: " + url)
  console.log("download folderPath: " + folderPath)
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  const client = await page.target().createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: folderPath,
  })

  async function goto(page, link) {
    return page.evaluate((link) => {
        location.href = link;
    }, link);
  }

  await goto(page, url);

  async function waitForDownload() {
    return new Promise((resolve, reject) => {
      const watcher = fs.watch(folderPath, (eventType, filename) => {
        console.log(`watch event type:${eventType}`);
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
      console.log('Downloaded file:', filename);

      const oldPath = path.join(folderPath, filename);
      var newPath = path.join(folderPath, mdname.replace(/\//g, '-') + '.md');

      // while (fs.existsSync(newPath)) {
      //   count++;
      //   newPath = path.join(folderPath, mdname.replace(/\//g, '-') + `(${count}).md`);
      // }

      console.log(`oldPath:${oldPath} and newPath:${newPath}`);
      // fs.renameSync(oldPath, newPath);
      // console.log('Moved file to:', newPath);
    } catch (error) {
      console.log(error);
      if (error.message === 'Download timed out' && retries < maxRetries) {
        console.log(`Retrying download... (attempt ${retries + 1})`);
        await downloadFile(count, retries + 1);
      } else {
        console.log(`download error: ` + error);
        // return Promise.reject(error);
      }
    }
  }

  await downloadFile()

  // await Promise.all([downloadFile(), new Promise((_, reject) => setTimeout(() => reject(new Error('Download timed out')), timeout))]);
}
// =======================
//   try {
//     const filename = await Promise.race([waitForDownload(), new Promise((_, reject) => setTimeout(() => reject(new Error('Download timed out')), timeout))]);
//     console.log('Downloaded file:', filename);

//     const oldPath = path.join(folderPath, filename);
//     const newPath = path.join(folderPath, book + '.md');
//     fs.renameSync(oldPath, newPath);
//     console.log('Moved file to:', newPath);
//   } catch (error) {
//     console.error(error);
//   }
// }

// ========================
//     });
//   }

//   // 下载卡住 - 重试
//   const filename = await waitForDownload();
//   console.log('Downloaded file:', filename);

//   const oldPath = path.join(folderPath, filename);
//   const newPath = path.join(folderPath, mdname.replace(/\//g, '-') + '.md');
//   console.log('Moved file to:', newPath, newPath);
//   fs.renameSync(oldPath, newPath);
// }





