const axios = require('axios');
const jsdom = require('jsdom');

const WIKI_BASE_URL = `https://riskofrain2.fandom.com`;
const WIKI_ITEMS_URL = `https://riskofrain2.fandom.com/wiki/Items`;

// Set this to true if you want to only retrieve new items from the Survivors expansion
const FLAG_EXPANSION_ONLY = true;
const INTERVAL_MS = 500;

const ITEM_TYPES = [
    'common',
    'uncommon',
    'legendary',
    'boss',
    'lunar',
    'void',
    'lunar_equipment',
    'equipment',
    'elite'
];

let itemCategoryIndex = 0;

(async () => {
    console.log('Getting page from', WIKI_ITEMS_URL);

    // Retrieve data from the wiki items url
    const resp = await axios.default.get(WIKI_ITEMS_URL);
    console.log('Received page data');

    // Pass the received HTML into JSDOM so that we can parse it
    const dom = new jsdom.JSDOM(resp.data);
    console.log(`Page title: ${dom.window.document.querySelector('title').textContent}`);

    // Find each .article-table in the page
    const element = dom.window.document.querySelectorAll('table.article-table tbody');
    if (element.length <= 0) {
        console.error('No tables found');
        process.exit(1);
    }
    console.log(`Found ${element.length} item tables`);

    // This is just our container to temporarily store the items
    const itemLinks = {
        common: [],
        uncommon: [],
        legendary: [],
        boss: [],
        lunar: [],
        void: [],
        lunar_equipment: [],
        equipment: [],
        elite: []
    };

    // For each table's body, traverse its rows and collect the links to each individual item page
    for (const tbody of element) {
        for (const tr of tbody.querySelectorAll('tr')) {
            // First cell contains links and images
            const links = Array.from(tr.cells[0].querySelectorAll('a'));
            const isExpansionRow = links.length === 3;
            // Skip invalid rows
            if (links.length < 2) continue;
            // Remove the expansion icon if it exists
            if (isExpansionRow) {
                links.shift();
            }
            // Run only for expansion rows if flag is set. Otherwise run as usual
            if (
                (FLAG_EXPANSION_ONLY === true && isExpansionRow) ||
                (FLAG_EXPANSION_ONLY === false && !isExpansionRow)) {
                // Parse the hyperlink from the cell
                itemLinks[ITEM_TYPES[itemCategoryIndex]].push(`${WIKI_BASE_URL}${links[1].href}`);
            }
        }
        itemCategoryIndex++;
    }   

    const content = {};

    // For each item in our above list (itemLinks), get the item information
    // Index starts at 126 since there's already 126 items in items.js
    let index = 126;
    for (const itemCategory of ITEM_TYPES) {
        for (const link of itemLinks[itemCategory]) {
            index++;
            content[Number(index)] = await getItemInformation(index, itemCategory, link);
        }   
    }

    console.log('--------------------- START OUTPUT ---------------------');
    console.log(JSON.stringify(content, null, 2));
    console.log('---------------------  END OUTPUT  ---------------------');

    console.log('Finished :)')

})();

/**
 * Given a wiki URL for an item, parse that page and retrieve relevant data for that item
 * @param {number} index the index to be used as an id for the item
 * @param {string} itemRarity the rarity of the item as a string, i.e. void, uncommon etc
 * @param {string} link the URL to retrieve the item data from
 * @returns an object containing name, image, shortDescription, description, itemRarity, id and categories
 */
async function getItemInformation(index, itemRarity, link) {
    console.log('Polling URL', link);

    // Query the individual item page and parse it with JSDOM
    const resp = await axios.default.get(link);
    const dom = new jsdom.JSDOM(resp.data);

    // Most of our data is stored in the table with class .infoboxtable
    const infobox = dom.window.document.querySelector('.infoboxtable');

    const name = infobox.querySelector('.infoboxname').textContent;
    const image = infobox.querySelector('.image > img').src;
    const shortDescription = infobox.querySelector('.infoboxcaption').textContent;
    const description = infobox.querySelector('.infoboxdesc').textContent;
    
    // Use jQuery to get the contents of the cell after the "Category" cell
    const $ = require('jquery')(dom.window);
    const dirtyCategories = $('tr > td:contains("Category")').next().contents();
    const categories = parseCategories(dirtyCategories);

    // Wait X sec before parsing the next link so that we don't get rate limited
    await sleep(INTERVAL_MS);

    return {
        name,
        image,
        shortDescription,
        description,
        itemRarity,
        id: index,
        categories
    }
}

/**
 * Given a jquery object containing categories from a URL, parse them into a usable data format
 * @param {object} jqElementList A jQuery object which contains one or more categories 
 * @returns An array of objects containing properties "href", "textContent" and "category"
 */
function parseCategories(jqElementList) {
    return jqElementList
        .filter('a')
        .map((_i, { href, textContent }) => [{ href, textContent, category: textContent.toUpperCase().replaceAll(/ /g, '_') }])
        .toArray();
}


/**
 * A simple sleep function. Don't forget to use `await`
 * @param {number} ms 
 * @returns a promise that resolves after the provided amount of milliseconds
 */
async function sleep(ms = INTERVAL_MS) {
    return new Promise(resolve => setTimeout(resolve, ms));
}