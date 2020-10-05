const chromium = require("chrome-aws-lambda");

/**
 * Takes in query, index, cat_id and sort_by in parameters
 */
const scrape = async (userId, password) => {
  let result = null;
  let browser = null;

  async function handleDailyDeclarationPage(page) {
    console.log("Handling Daily Declaration");
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

  async function handleLogin(page, userId, password) {
    console.log("Login");
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
      slowMo: 200,
      headless: false,
      ignoreHTTPSErrors: true,
    });

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

    //travelled
    var [option1] = await dailyDeclarationPage.$x(
      `//input[@id="pgContent1_rbVisitOtherCountryNo" and @type="radio" and @name="ctl00$pgContent1$OtherCountryVisited"]`
    );

    if (option1 != null) {
      option1.click();
    }

    // clicking the first option for daily dec will trigger a page refresh
    // hence, we get the page context again through browser

    await wait(500);

    let pages = await browser.pages();
    dailyDeclarationPage = pages.filter(
      (page) => page.url() == "https://tts.sutd.edu.sg/tt_daily_dec_user.aspx"
    )[0];

    await handleDailyDeclarationPage(dailyDeclarationPage);
  } catch (error) {
    console.log(error);
  } finally {
    // if (browser !== null) {
    //   await browser.close();
    // }
  }

  console.log("Finished");
};

//scrape("1005292", "password");