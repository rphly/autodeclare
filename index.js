const chromium = require("chrome-aws-lambda");
const Captcha = require("2captcha");

const solver = new Captcha.Solver("");

/**
 * Takes in query, index, cat_id and sort_by in parameters
 */
exports.handler = async (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify("Finished."),
  };

  let queryParams = event.queryStringParameters;

  let userId = queryParams.userId.toString();
  let password = queryParams.password.toString();

  await autodeclare(userId, password, 5);

  return response;
};

async function autodeclare(username, password, retries) {
  if (retries == 0) {
    // notify failure
    console.log(`Maximum retries reached. Ending...`);
    return;
  }

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    let loginPage = await startNewPageAndGo(
      `https://tts.sutd.edu.sg/tt_login.aspx`,
      browser
    );

    let loginSuccess = await handleLogin(loginPage, username, password);

    if (loginSuccess) {
      let temperatureTakingPage = await startNewPageAndGo(
        `https://tts.sutd.edu.sg/tt_temperature_taking_user.aspx`,
        browser
      );

      let dailyDeclarationPage = await startNewPageAndGo(
        `https://tts.sutd.edu.sg/tt_daily_dec_user.aspx`,
        browser
      );

      await Promise.all([
        handleTemperatureTaking(temperatureTakingPage),
        handleDailyDeclaration(dailyDeclarationPage, browser),
      ]);
    } else {
      // retry
      autodeclare(username, password, retries - 1);
    }
  } catch (error) {
    console.log(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}

async function handleLogin(page, username, password) {
  console.log("Attempting to log in...");

  try {
    await handleCaptcha(page);
  } catch (e) {
    console.log(e);
    console.log(`An error occurred while handling captcha for ${username}`);
    return false;
  }

  var [input] = await page.$x(
    `//input[@id='pgContent1_uiLoginid' and @name="ctl00$pgContent1$uiLoginid"]`
  );
  if (input) {
    await input.type(username);
  }

  [input] = await page.$x(
    `//input[@id='pgContent1_uiPassword' and @name="ctl00$pgContent1$uiPassword"]`
  );
  if (input) {
    await input.type(password);
  }

  const [button] = await page.$x(
    `//input[@id='pgContent1_btnLogin' and @name="ctl00$pgContent1$btnLogin"]`
  );

  if (button) {
    await Promise.all([
      button.click(),
      page.waitForNavigation({ waitUntil: `networkidle0` }),
      wait(200),
    ]);
    return page.url().includes(`tt_home_user`);
  }
}

async function handleDailyDeclaration(page, browser) {
  console.log("Handling daily declaration...");
  var [option1] = await page.$x(
    `//input[@id="pgContent1_cbSetToNo" and @type="checkbox" and @name="ctl00$pgContent1$cbSetToNo"]`
  );

  if (option1 != null) {
    await Promise.all([option1.click(), page.waitForNavigation()]);
  }

  // clicking the first option for daily dec will trigger a page refresh
  // hence, we get the page context again through browser

  let pages = await browser.pages();
  newDecPage = pages.filter(
    (page) => page.url() == "https://tts.sutd.edu.sg/tt_daily_dec_user.aspx"
  )[0];
  console.log(4);
  const [button] = await newDecPage.$x(
    `//input[@id='pgContent1_btnSave' and @name="ctl00$pgContent1$btnSave"]`
  );
  console.log(5);
  if (button != null) {
    await wait(200);
    button.click();
    page.on("dialog", async (dialog) => {
      let msg = dialog.message();
      console.log(msg);
      page.close();
      return msg.includes(`Your submission is successful`);
    });
  }

  await wait(200);
  return;
}

async function handleTemperatureTaking(page) {
  console.log("Handling Temp taking");
  // find option
  var [option] = await page.$x(
    `//option[text() = "Less than or equal to 37.6°C"]`
  );

  if (option == null) {
    return false;
  }

  // in case value != option text
  const value = await (await option.getProperty("value")).jsonValue();

  // find dropdown
  var [select] = await page.$x(
    `//select[@id='pgContent1_uiTemperature' and @name="ctl00$pgContent1$uiTemperature"]`
  );

  if (select) {
    await page.select("#pgContent1_uiTemperature", value);
  }

  const [button] = await page.$x(
    `//input[@id='pgContent1_btnSave' and @name="ctl00$pgContent1$btnSave"]`
  );

  await wait(200);

  if (button) {
    await Promise.all([button.click()]);
    page.on("dialog", async (dialog) => {
      let msg = dialog.message();
      console.log(msg);
      return msg.includes(`Your submission is successful`);
    });
  }
  return;
}

async function handleCaptcha(page) {
  console.log("Handling Captcha...");
  await page.waitForSelector("#pgContent1_Image2");
  const [captchaImageNode] = await page.$x(`//img[@id='pgContent1_Image2']`);

  const captchaImage = await captchaImageNode.screenshot({
    encoding: "base64",
  });

  // call 2Captcha
  const { data, id } = await solver.imageCaptcha(captchaImage, {
    regsense: 1,
  });

  console.log(`This is the captcha: ${data}`);

  const [input] = await page.$x(
    `//input[@id='pgContent1_txtVerificationCode' and @name="ctl00$pgContent1$txtVerificationCode"]`
  );
  if (input) {
    await input.type(data);
  }

  wait(200);
}

async function startNewPageAndGo(url, browser) {
  let page = await browser.newPage();
  console.log(url);

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
  );

  await page.goto(url, {
    waitUntil: "load",
    timeout: 0,
  });

  await page.setDefaultNavigationTimeout(0);

  return page;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}
