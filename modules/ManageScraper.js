const puppeteer = require('puppeteer');
const { ObjectId } = require('mongodb');
const { 
  findDataInMedias,
  sanitizeData,
  initCategories 
} = require('../services/tools')
// Helper function to find user and update their scraped data
async function findAndUpdateUser(userId, newScrapedData = null) {
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) console.log('User not found in the database.');
  return user;
}

async function ManageScraper(url, nsfw, mode, user, page) {

  const scrapeMode = require(`./scraper/scrapeMode${mode}`);
  const userId = new ObjectId(user._id);
  const currentTime = new Date().getTime();

  const userInfo = await findAndUpdateUser(userId);

  const existingData = userInfo.scrapInfo?.[url];
  const moreThan24h = existingData
      ? currentTime - Number(existingData.time) > 24 * 60 * 60 * 1000
      : true;

  scrapedData = await findDataInMedias(userId, {
    query:url,
    mode: mode,
    nsfw: nsfw,
     page:parseInt(page),
    hide_query: { $exists: false },
    hide: { $exists: false },
  });

  if(scrapedData && scrapedData.length > 0){
    console.log(`Found ${scrapedData.length} items in the medias collection`)
    return scrapedData
  }

  
  scrapedData = await scrapeMode(url, mode, nsfw, page);

  console.log(`Scrape data and found ${scrapedData.length} elements.`)

  const categories = await initCategories(userId)

  scrapedData = scrapedData.map((data) => ({
    ...data,
    query: url,
    mode: mode,
    nsfw: nsfw,
     page:parseInt(page),
    userId: userId,
    categories:categories
  })); 


  if (scrapedData && scrapedData.length > 0) {
    // 配列の各要素に対して、非同期処理を実行
    for (const item of scrapedData) {
      // 同一ソースを検索するための条件
      const condition = { source: item.source, hide: { $exists: true } };
      // 条件に一致するアイテムが存在するか確認
      const existingItem = await global.db.collection('medias').findOne(condition);
      // アイテムが存在しない場合、新しいアイテムを挿入
      if (!existingItem) {
        await global.db.collection('medias').insertOne(item);
      }
      // 存在する場合、スキップ
    }
  
    console.log(`挿入または更新 ${scrapedData.length} メディアアイテムをデータベースに.`);
  }
  
  

  url = url ? url : process.env.DEFAULT_URL

  await checkUserScrapeInfo(user)
  const scrapInfo = userInfo.scrapInfo.find(info => info.url === url);
  
  if (scrapInfo) {
    // If the URL already exists, update the time and page
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId), 'scrapInfo.url': url },
      {
        $set: {
          'scrapInfo.$.time': currentTime,
          'scrapInfo.$.page': page
        }
      }
    );
  } else {
    // If the URL doesn't exist, push the new scrapInfo
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          scrapInfo: { url: url, time: currentTime, page: page }
        }
      },
      { upsert: true }
    );
  }
  
  console.log('Update user scrapInfo.')

  scrapedData = await findDataInMedias(userId, {
    query:url,
    mode: mode,
    nsfw: nsfw,
     page:parseInt(page),
    hide_query: { $exists: false },
    hide: { $exists: false },
  });

  return scrapedData;
}

async function checkUserScrapeInfo(user){
  const scrapInfo = Array.isArray(user.scrapInfo) 
  if(!scrapInfo){
        // If the URL doesn't exist, push the new scrapInfo
        await global.db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set:{scrapInfo: []}
            
          },
          { upsert: true }
        );
  }
}
module.exports = ManageScraper;
