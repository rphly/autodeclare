const chromium = require("chrome-aws-lambda");
const Captcha = require("2captcha");

const solver = new Captcha.Solver("");

/**
 * Takes in query, index, cat_id and sort_by in parameters
 */
exports.handler = async (event, context, callback) => {
  let result = null;
  let browser = null;

  async function handleDailyDeclarationPage(page) {
    console.log("Handling Daily Declaration");
    await wait(100);
    // quarantine order
    var [option2] = await page.$x(
      `//input[@id="pgContent1_rbNoticeNo" and @type="radio" and @name="ctl00$pgContent1$Notice"]`
    );

    if (option2 != null) {
      console.log("option 2");
      option2.click();
    }

    // close contact
    var [option3] = await page.$x(
      `//input[@id="pgContent1_rbContactNo" and @type="radio" and @name="ctl00$pgContent1$Contact"]`
    );

    if (option3 != null) {
      console.log("option 3");
      option3.click();
    }

    // MC for resp symptoms
    var [option4] = await page.$x(
      `//input[@id="pgContent1_rbMCNo" and @type="radio" and @name="ctl00$pgContent1$MC"]`
    );

    if (option4 != null) {
      console.log("option 4");
      option4.click();
    }

    const [button] = await page.$x(
      `//input[@id='pgContent1_btnSave' and @name="ctl00$pgContent1$btnSave"]`
    );

    if (button != null) {
      await wait(200);
      button.click();
      console.log("Button clicked");
    }

    await wait(500);
    return;
  }

  async function handleTemperatureTakingPage(page) {
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

    if (button) {
      await Promise.all([button.click(), wait(200)]);
      page.close();
      return;
    }
  }

  async function handleCaptcha(page) {
    console.log("Handling Captcha");
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

  async function handleLogin(page, userId, password) {
    console.log("Login");

    await handleCaptcha(page);

    var [input] = await page.$x(
      `//input[@id='pgContent1_uiLoginid' and @name="ctl00$pgContent1$uiLoginid"]`
    );
    if (input) {
      await input.type(userId);
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
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms));
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

    return page;
  }

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: false,
      slowMo: 200,
      ignoreHTTPSErrors: true,
    });

    let queryParams = event.queryStringParameters;

    let userId = queryParams.userId.toString();
    let password = queryParams.password.toString();

    loginPage = await startNewPageAndGo(
      `https://tts.sutd.edu.sg/tt_login.aspx`,
      browser
    );

    await handleLogin(loginPage, userId, password);

    temperatureTakingPage = await startNewPageAndGo(
      `https://tts.sutd.edu.sg/tt_temperature_taking_user.aspx`,
      browser
    );

    await handleTemperatureTakingPage(temperatureTakingPage);

    dailyDeclarationPage = await startNewPageAndGo(
      `https://tts.sutd.edu.sg/tt_daily_dec_user.aspx`,
      browser
    );

    var [option1] = await dailyDeclarationPage.$x(
      `//input[@id="pgContent1_cbSetToNo" and @type="checkbox" and @name="ctl00$pgContent1$cbSetToNo"]`
    );

    if (option1 != null) {
      console.log("option 1");
      option1.click();
    }

    // clicking the first option for daily dec will trigger a page refresh
    // hence, we get the page context again through browser

    await wait(1000);

    let pages = await browser.pages();
    console.log(pages);

    let newDecPage = pages.filter(
      (page) => page.url() == "https://tts.sutd.edu.sg/tt_daily_dec_user.aspx"
    )[0];

    console.log(newDecPage);

    const [button] = await newDecPage.$x(
      `//input[@id='pgContent1_btnSave' and @name="ctl00$pgContent1$btnSave"]`
    );

    if (button != null) {
      await wait(200);
      button.click();
      console.log("Button clicked");
    }

    await wait(500);
  } catch (error) {
    console.log(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("Finished."),
  };

  return response;
};
