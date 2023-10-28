import fs from 'fs';

export async function autoLogin(page) {
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
}

