const fs = require('fs');
const readline = require('readline');

const REF = 'TENX';
const QUOTE_TWEET_URL = 'https://x.com/LebrelAI/status/2112227280848048494';
const BASE = 'https://early.lebrel.ai';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0 Safari/537.36';

const emails = fs.readFileSync('email.txt', 'utf8').trim().split('\n').map(s => s.trim());
const usns = fs.readFileSync('usn.txt', 'utf8').trim().split('\n').map(s => s.trim());
const akuns = fs.readFileSync('akun.txt', 'utf8').trim().split('\n\n').map(b => {
  const [auth, ct0] = b.trim().split('\n');
  return { auth: auth.trim(), ct0: ct0.trim() };
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

function lebrelHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Origin': BASE,
    'Referer': `${BASE}/quests.html`,
    'User-Agent': UA,
  };
}

function xHeaders(auth, ct0) {
  return {
    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LTa2tjN6MuZFHVx3etmEGGVjC2xVFVDRh8ESIFK4',
    'cookie': `auth_token=${auth}; ct0=${ct0}`,
    'x-csrf-token': ct0,
    'content-type': 'application/json',
    'User-Agent': UA,
  };
}

async function followLebrel(auth, ct0) {
  const res = await fetch('https://x.com/i/api/1.1/friendships/create.json', {
    method: 'POST',
    headers: {
      ...xHeaders(auth, ct0),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'screen_name=LebrelAI&skip_status=true',
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return true;
}

async function postQuoteTweet(auth, ct0, text, quoteUrl) {
  const variables = {
    tweet_text: text,
    attachment_url: quoteUrl,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: [],
    disallowed_reply_controls: [],
  };
  const features = {
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    articles_preview_enabled: true,
    rweb_video_timestamps_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    freedom_of_speech_not_reach_the_sky_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  };

  const res = await fetch('https://x.com/i/api/graphql/UYy9vA3EXPE1yUjdMBPpxg/CreateTweet', {
    method: 'POST',
    headers: xHeaders(auth, ct0),
    body: JSON.stringify({ variables, features, queryId: 'UYy9vA3EXPE1yUjdMBPpxg' }),
  });

  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  const tweetId = data?.data?.create_tweet?.tweet_results?.result?.rest_id;
  if (!tweetId) throw new Error('No tweet ID: ' + JSON.stringify(data));
  const username = data?.data?.create_tweet?.tweet_results?.result?.core?.user_results?.result?.legacy?.screen_name;
  return `https://x.com/${username}/status/${tweetId}`;
}

async function getLebrelToken(email) {
  const res = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Origin': BASE, 'Referer': `${BASE}/` },
    body: JSON.stringify({ email, ref: REF }),
  });
  const data = await res.json();
  return data.token || null;
}

async function doQuote(token, auth, ct0) {
  const me = await fetch(`${BASE}/api/me`, { headers: lebrelHeaders(token) }).then(r => r.json());
  if (me.quests.quote) { console.log(`  Quote skip.`); return; }

  const quoteText = `Getting early access to @LebrelAI: private, uncensored AI through chat and API.\n\nJoin with my invite link: ${me.referral_link}`;
  console.log(`  Post quote tweet...`);
  try {
    const tweetUrl = await postQuoteTweet(auth, ct0, quoteText, QUOTE_TWEET_URL);
    console.log(`  Tweet: ${tweetUrl}`);
    await sleep(3000);
    const r = await fetch(`${BASE}/api/quest/quote`, {
      method: 'POST',
      headers: lebrelHeaders(token),
      body: JSON.stringify({ url: tweetUrl }),
    }).then(r => r.json());
    console.log(`  Quote: ${r.quests?.quote ? 'OK' : 'Gagal'} | Points: ${r.points}`);
    await sleep(2000);
  } catch (err) {
    console.log(`  Gagal post tweet:`, err.message);
  }
}

async function processAkun(index, onlyQuote) {
  const email = emails[index];
  const usn = usns[index];
  const { auth, ct0 } = akuns[index];

  console.log(`\n[${index + 1}] ${email} (@${usn})`);

  const token = await getLebrelToken(email);
  if (!token) { console.log(`  Gagal dapet token`); return; }
  console.log(`  Token OK`);

  if (onlyQuote) {
    await doQuote(token, auth, ct0);
    return;
  }

  const me = await fetch(`${BASE}/api/me`, { headers: lebrelHeaders(token) }).then(r => r.json());
  const q = me.quests;
  console.log(`  Quest - follow:${q.follow} like:${q.like} quote:${q.quote} card:${q.card}`);

  // Submit username X
  if (!me.x) {
    console.log(`  Submit username @${usn}...`);
    await fetch(`${BASE}/api/x`, {
      method: 'POST',
      headers: lebrelHeaders(token),
      body: JSON.stringify({ username: usn }),
    });
    console.log(`  Nunggu 10 detik...`);
    await sleep(10000);
  } else {
    console.log(`  Username X sudah ada: @${me.x.username}`);
  }

  // Follow
  if (!q.follow) {
    console.log(`  Auto follow @LebrelAI...`);
    try {
      await followLebrel(auth, ct0);
      console.log(`  Follow X OK`);
    } catch (err) {
      console.log(`  Gagal follow X:`, err.message);
    }
    console.log(`  Claim follow...`);
    const r = await fetch(`${BASE}/api/quest/follow`, { method: 'POST', headers: lebrelHeaders(token) }).then(r => r.json());
    console.log(`  Follow quest: ${r.quests?.follow ? 'OK' : 'Gagal'} | Points: ${r.points}`);
    await sleep(2000);
  } else {
    console.log(`  Follow skip.`);
  }

  // Like
  if (!q.like) {
    console.log(`  Nunggu 5 detik lalu claim like...`);
    await sleep(5000);
    const r = await fetch(`${BASE}/api/quest/like`, { method: 'POST', headers: lebrelHeaders(token) }).then(r => r.json());
    console.log(`  Like: ${r.quests?.like ? 'OK' : 'Gagal'} | Points: ${r.points}`);
    await sleep(2000);
  } else {
    console.log(`  Like skip.`);
  }

  // Quote
  await doQuote(token, auth, ct0);

  // Card
  const meNow = await fetch(`${BASE}/api/me`, { headers: lebrelHeaders(token) }).then(r => r.json());
  if (!meNow.quests.card) {
    console.log(`  Claim card...`);
    const r = await fetch(`${BASE}/api/quest/card`, {
      method: 'POST',
      headers: lebrelHeaders(token),
      body: '{}',
    }).then(r => r.json());
    console.log(`  Card: ${r.quests?.card ? 'OK' : 'Gagal'} | Points: ${r.points}`);
  } else {
    console.log(`  Card skip.`);
  }

  const final = await fetch(`${BASE}/api/me`, { headers: lebrelHeaders(token) }).then(r => r.json());
  console.log(`  Selesai! Points: ${final.points} | Rank: #${final.rank}`);
}

async function main() {
  const total = emails.length;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  console.log(`Total akun: ${total}`);
  console.log('1. 1 akun');
  console.log('2. Semua akun');
  console.log('3. From X to end');
  const pilihan = await ask('Pilih (1/2/3): ');

  let indices = [];
  if (pilihan === '1') {
    const n = parseInt(await ask(`Nomor akun (1-${total}): `)) - 1;
    indices = [n];
  } else if (pilihan === '2') {
    indices = [...Array(total).keys()];
  } else if (pilihan === '3') {
    const n = parseInt(await ask(`Start dari nomor (1-${total}): `)) - 1;
    indices = [...Array(total).keys()].slice(n);
  }

  console.log('1. All quest');
  console.log('2. Post aja');
  const mode = await ask('Pilih (1/2): ');
  const onlyQuote = mode === '2';

  rl.close();

  for (const i of indices) {
    await processAkun(i, onlyQuote);
    if (i < indices[indices.length - 1]) await sleep(3000);
  }

  console.log('\nSemua selesai!');
}

main().catch(console.error);
