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
      await page.waitForSelector('.switch-btn');
      await page.click('.switch-btn');
  
      // Fill in phone number and password
      await page.waitForSelector('input[data-testid=prefix-phone-input]');
      await page.type('input[data-testid=prefix-phone-input]', process.env.USER);
      await page.waitForSelector('input[data-testid=loginPasswordInput]');
      await page.type('input[data-testid=loginPasswordInput]', process.env.PASSWORD);
  
      await scrollCaptcha(page)

      // Check agreement checkbox
      await page.click('input[data-testid=protocolCheckBox]');
  
      // Click login button
      await page.click('button[data-testid=btnLogin]');
  
      // 等待页面跳转完成
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
      // 保存 cookie 到本地文件
      cookies = await page.cookies();
      fs.writeFileSync(cookieFile, JSON.stringify(cookies));
      
      console.log("Save cookie to cookies.json")
    }
}

async function scrollCaptcha(page) {
  const legacySlider = await page.$('span[id="nc_2_n1z"]');
  if (legacySlider) {
    await solveLegacyCaptcha(page, legacySlider);
    return;
  }

  const aliyunSlider = await page.$('#aliyunCaptcha-sliding-slider');
  if (!aliyunSlider) {
    console.log('No slider captcha detected, continue login...');
    return;
  }

  if (isManualModeEnabled()) {
    console.log('Aliyun slider captcha detected. Please complete it manually in the opened browser window...');
    await waitForCaptchaVerification(page, 180000);
    console.log('Captcha solved manually.');
    return;
  }

  console.log('Aliyun slider captcha detected, try automatic solve...');
  const solved = await solveAliyunCaptcha(page);
  if (solved) {
    console.log('Captcha solved automatically.');
    return;
  }

  throw new Error('Captcha auto-solve failed. Set HEADLESS=false and complete the slider manually in the browser window, or reuse cookies.json for login.');
}

async function solveLegacyCaptcha(page, legacySlider) {
  const startinfo = await legacySlider.boundingBox();
  const end = await page.waitForSelector('.nc-lang-cnt');
  const endinfo = await end.boundingBox();

  await page.mouse.move(startinfo.x, endinfo.y);
  await page.mouse.down();
  for (let i = 0; i < endinfo.width; i++) {
      await page.mouse.move(startinfo.x + i, endinfo.y);
  }
  await page.mouse.up();
}

async function solveAliyunCaptcha(page) {
  const slider = await page.$('#aliyunCaptcha-sliding-slider');
  const body = await page.$('#aliyunCaptcha-sliding-body');

  if (!slider || !body) {
    return false;
  }

  const sliderBox = await slider.boundingBox();
  const bodyBox = await body.boundingBox();
  if (!sliderBox || !bodyBox) {
    return false;
  }

  const startX = sliderBox.x + sliderBox.width / 2;
  const startY = sliderBox.y + sliderBox.height / 2;
  const endX = bodyBox.x + bodyBox.width - sliderBox.width / 2 - 4;

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.mouse.move(startX, startY, { steps: 8 });
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(150);

    for (let i = 0; i <= 40; i++) {
      const progress = i / 40;
      const x = startX + (endX - startX) * progress;
      const y = startY + Math.sin(progress * Math.PI) * 3;
      await page.mouse.move(x, y, { steps: 1 });
      await page.waitForTimeout(15 + Math.floor(Math.random() * 20));
    }

    await page.waitForTimeout(200);
    await page.mouse.up();

    const verified = await waitForCaptchaVerification(page, 4000, false);
    if (verified) {
      return true;
    }

    const refreshButton = await page.$('#aliyunCaptcha-sliding-refresh');
    if (refreshButton) {
      await refreshButton.click();
      await page.waitForTimeout(800);
    }
  }

  return false;
}

async function waitForCaptchaVerification(page, timeout = 120000, throwOnTimeout = true) {
  const start = Date.now();

  try {
    while (Date.now() - start < timeout) {
      if (page.isClosed()) {
        throw new Error('Browser window was closed before captcha verification completed.');
      }

      const verified = await page.evaluate(() => {
        const captcha = document.querySelector('#captcha');
        const verify = document.querySelector('#captchaVerifyParam');
        return Boolean(captcha && captcha.value && verify && verify.value);
      }).catch((error) => {
        if (String(error).includes('Target closed')) {
          throw new Error('Browser target was closed while waiting for captcha verification.');
        }
        throw error;
      });

      if (verified) {
        return true;
      }

      await page.waitForTimeout(500);
    }

    throw new Error(`Captcha verification timed out after ${Math.floor(timeout / 1000)} seconds.`);
  } catch (error) {
    if (!throwOnTimeout) {
      return false;
    }
    throw error;
  }
}

function isManualModeEnabled() {
  return process.env.HEADLESS === 'false';
}
