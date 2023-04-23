const chromium = require("@sparticuz/chrome-aws-lambda")
const { addExtra } = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const { getFirestore, doc, getDoc, setDoc, collection,  } = require("firebase/firestore");
const { app } = require('./initializeFirebase');
const db = getFirestore(app);

const url_id = "https://www.linkedin.com/groups/14048479/members/"
const groupId = url_id.match(/groups\/(\d+)\/members/)[1];
const LI_AT = "AQEDAS2vRC0DXh9iAAABh6YlgyoAAAGHyjIHKlYArAdsUf9SFyuTfdCNuhQ-s68JcyiZT7BQVfNduJvbaDyRkmjGXF2bSPfiMKzkxNCW4iSHctkjDx-Q22lBECwPh601WoxTXGau16PS8UJ7cZKdfxJ8"

async function linkedinScraper() {
    // see if group id document already exists and if not create it
    const userRef = doc(db, "linkedin-sent-messages", groupId)
    const userDoc = await getDoc(userRef)
    if (!userDoc.exists()) {
        await setDoc(userRef, { messaged: ["genesislink"] })
    } else {
        console.log("doc exists")
    }
    // puppeteer launching logic
    const puppeteerExtra = addExtra(chromium.puppeteer)
    puppeteerExtra.use(pluginStealth())
    const browser = await puppeteerExtra.launch({
        args: chromium.args, defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath, ignoreHTTPSErrors: true, headless: chromium.headless,
    })
    const page = await browser.newPage();
    await page.setViewport({ width: 950, height: 1000 });


    await page.setCookie({
        name: 'li_at',
        value: LI_AT,
        domain: 'www.linkedin.com',
        path: '/',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 365
    })
    
    // find the number of members in the group
    await page.goto(url_id, { waitUntil: 'networkidle2' })
    const membersText = await page.$eval('.groups-members-list h1', el => el.textContent);
    const membersCount = parseInt(membersText.replace(/\D/g,'')); // extract only digits and convert to integer
            // scroll down a little bit
    await page.evaluate(() => {
        window.scrollBy(0, 500);
    });

    for (let i = 0; i < membersCount; i++) {
        const newestUserDoc = await getDoc(userRef)
        const contactRows = await page.$$('.ui-entity-action-row');
        const row = contactRows[i]
        // check if it is time to load more of the page (name will fail if so)
        let name = ""
        try {
            name = await row.$eval('.artdeco-entity-lockup__title', el => el.textContent.trim());
        } catch {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(1000);
            // wait for the new rows to load
            await page.waitForSelector('.ui-entity-action-row');
            continue;
        }
        const firstName = name.split(' ')[0];

        const href = await row.$eval('a', el => el.getAttribute('href'));
        const messagedArray = newestUserDoc.data().messaged;
        if (messagedArray.includes(href)) {
            console.log(`Skipping user with href: ${href}`);
            continue;
        }
        // try-catch just in case the user is you, you dont have a message button
        try {
            const button = await row.$('.artdeco-button'); // find the button element inside the row
            await button.click();
        } catch (error) {
            console.log("error")
            continue;
        }

        await page.waitForSelector('.msg-form__contenteditable');
        // await page.type('.msg-form__contenteditable', `Hi ${firstName}, how are you doing?`);
        // await page.click('.msg-form__send-button');
        // await page.waitForSelector('.msg-s-message-list');
        await page.waitForTimeout(1000);

        // close the message window
        const closeIcon = await page.$('.msg-convo-wrapper li-icon[type="close"]');
        await closeIcon.click();
        await page.waitForTimeout(1000);
        
        // scroll down a little bit
        await page.evaluate(() => {
            window.scrollBy(0, 100);
        });

        const newHrefs = [...newestUserDoc.data().messaged, href]
        await setDoc(userRef, { messaged: newHrefs })

        console.log(i);
      }


   
    // await browser.close();
}

linkedinScraper();

// for (const row of contactRows) {
//     // check if user is already in firebase and if so continue
//     const href = await row.$eval('a', el => el.getAttribute('href'));
//     const messagedArray = userDoc.data().messaged;
//     if (messagedArray.includes(href)) {
//         console.log(`Skipping user with href: ${href}`);
//         continue;
//     }
//     // messaging logic
//     const name = await row.$eval('.artdeco-entity-lockup__title', el => el.textContent.trim());
//     const firstName = name.split(' ')[0];

//     // just in case the user is you, you dont have a message button
//         const button = await row.$('.artdeco-button'); // find the button element inside the row
//         await button.click();

//     await page.waitForSelector('.msg-form__contenteditable');
//     // await page.type('.msg-form__contenteditable', `Hi ${firstName}, how are you doing?`);
//     // await page.click('.msg-form__send-button');
//     // await page.waitForSelector('.msg-s-message-list');
//     await page.waitForTimeout(4000);

//     // close the message window
//     const closeIcon = await page.$('.msg-convo-wrapper li-icon[type="close"]');
//     await closeIcon.click();
//     await page.waitForTimeout(3000);

//     const newHrefs = [...userDoc.data().messaged, href]
//     await setDoc(userRef, { messaged: newHrefs })
// }