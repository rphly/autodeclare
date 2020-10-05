# Autodeclare

I wrote this to automate the mechanistic parts of temperature taking and daily declarations that we must do if we stay in hostel @ SUTD.

Disclaimer:
Use this to autofill only if you have taken your temperature and are certain that you are 100% A-OK. If not, please fill it up manually at tts.sutd.edu.sg.

## Running locally

If running locally, go into run.js and replace my userId and password with your login credentials.

    cd autodeclare
    npm install
    node run.js

Ta-da.

## Deploy

Autodeclare relies on Puppeteer and Chromium. They don't play well with Lambda but there's a package that we use, "chrome-aws-lambda" that solves this.

The updated lambda code is in `index.js`, copy that and voila you can now run the script via the url.

url takes in params userId and password.

## Please use responsibly!
