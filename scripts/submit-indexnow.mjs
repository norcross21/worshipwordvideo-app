import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const host = 'www.worshipwordvideo.org';
const key = 'b2b960d2c713e3e71a89a4f6e34345d1';
const urlList = JSON.parse(await readFile(resolve(process.cwd(), 'public/seo-urls.json'), 'utf8'));
const response = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/indexnow-key.txt`,
    urlList,
  }),
});

if (!response.ok) {
  throw new Error(`IndexNow submission failed: ${response.status} ${await response.text()}`);
}

console.log(`Submitted ${urlList.length} public URLs to IndexNow (${response.status}).`);
