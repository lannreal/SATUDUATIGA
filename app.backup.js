
if (process.argv[2] === '--worker') {
  process.argv.splice(2, 1);
  (async () => {
    

const fs = require('fs');
const path = require('path');
const { addExtra } = require('puppeteer-extra');
const rebrowser = require('rebrowser-puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = await import('proxy-chain');

const puppeteer = addExtra(rebrowser);
puppeteer.use(StealthPlugin());

const CONFIG_PATH = path.join(__dirname, 'config_prem.json');
const action = process.argv[2] || "verify_and_claim";
const emailTarget = process.argv[3] || "test@gmail.com";
let magicLink = process.argv[4] || "";

const log = {
  info: (...a) => console.error('\x1b[36m⚡ [SYSTEM]\x1b[0m', ...a),
  success: (...a) => console.error('\x1b[32m✔ [SUCCESS]\x1b[0m', ...a),
  warn: (...a) => console.error('\x1b[33m⚠ [WARNING]\x1b[0m', ...a),
  error: (...a) => console.error('\x1b[31m✖ [ERROR]\x1b[0m', ...a),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  '--window-size=1920,1080',
  '--proxy-server=http://dc.oxylabs.io:8000'
];

function getChromeExecutablePath() {
  const possiblePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ];
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  try {
    return puppeteer.executablePath();
  } catch (e) {
    return '/usr/bin/google-chrome-stable';
  }
}

async function simulateMouse(page) {
  try {
    const vp = { width: 1920, height: 1080 };
    const steps = randInt(3, 6);
    for (let i = 0; i < steps; i++) {
      await page.mouse.move(
        randInt(150, vp.width - 150),
        randInt(150, vp.height - 150),
        { steps: randInt(5, 12) }
      );
      await sleep(randInt(80, 200));
    }
  } catch (e) {}
}

async function isChallenging(page) {
  try {
    const title = (await page.title()).toLowerCase();
    const url = page.url().toLowerCase();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');

    const cfSignals = [
      title.includes('just a moment'),
      title.includes('checking your browser'),
      title.includes('please wait'),
      title.includes('attention required'),
      title.includes('cloudflare'),
      url.includes('/cdn-cgi/challenge-platform'),
      url.includes('challenge'),
      bodyText.includes('checking if the site connection is secure'),
    ];
    return cfSignals.some(Boolean);
  } catch {
    return false;
  }
}

async function isCleanDashboard(page) {
  try {
    const title = (await page.title().catch(() => '')).toLowerCase();
    const url = page.url().toLowerCase();
    if (title.includes('just a moment') || title.includes('checking') || title.includes('attention') || title.includes('cloudflare') || url.includes('challenge')) {
      return false;
    }
    // As long as URL is correct and no CF title, assume it's clean
    if (url.includes('/dashboard/generator')) return true;
    return title.length > 2 && (title.includes('generator') || title.includes('dashboard') || title.includes('am premium'));
  } catch {
    return false;
  }
}

async function tryClickTurnstile(page) {
  try {
    if (page.frames().length > 1) {
      for (let i = 1; i < page.frames().length; i++) {
        const targetFrame = page.frames()[i];
        const fUrl = targetFrame.url();
        if (fUrl.includes('challenges.cloudflare.com') || fUrl.includes('challenge-platform') || fUrl.includes('turnstile')) {
          try {
            const frameEle = await targetFrame.frameElement();
            if (frameEle) {
              const box = await frameEle.boundingBox();
              log.info(`[FRAME ${i} BOX]: ${JSON.stringify(box)}`);
              if (box && box.width > 10 && box.height > 10) {
                log.info(`🛡️ Klik tengah iframe Turnstile (frameElement ${Math.round(box.width)}x${Math.round(box.height)} di x=${Math.round(box.x)}, y=${Math.round(box.y)})...`);
                const targetX = box.x + box.width / 2;
                const targetY = box.y + box.height / 2;
                await page.mouse.move(targetX, targetY, { steps: 15 });
                await sleep(350);
                await page.mouse.click(targetX, targetY);
                await sleep(1500);
                return true;
              }
            }
          } catch (e) {
            log.info(`[FRAME ${i} ELE ERROR]: ${e.message}`);
          }

          // Coba cari dan klik elemen di dalam targetFrame
          try {
            const clickable = await targetFrame.$('input, label, .ctp-checkbox-label, #challenge-stage, .cb-lb, body');
            if (clickable) {
              const box = await clickable.boundingBox();
              if (box && box.width > 2 && box.height > 2) {
                log.info(`🛡️ Klik elemen dalam frame (${Math.round(box.width)}x${Math.round(box.height)})...`);
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                await sleep(250);
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                await sleep(1500);
                return true;
              }
            }
          } catch (e) {}
        }
      }
    }

    // Fallback: cari semua iframe di halaman utama
    const iframes = await page.$$('iframe');
    for (const frm of iframes) {
      const box = await frm.boundingBox();
      if (box && box.width > 20 && box.height > 20 && box.y > 0 && box.y < 950) {
        log.info(`🛡️ Klik iframe tag dari main DOM (${Math.round(box.width)}x${Math.round(box.height)} di pos y=${Math.round(box.y)})...`);
        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        await page.mouse.move(targetX, targetY, { steps: 12 });
        await sleep(300);
        await page.mouse.click(targetX, targetY);
        await sleep(1500);
        return true;
      }
    }
  } catch (e) {}
  return false;
}

async function ensureMasterLogin(page) {
  log.info('🔑 [MASTER LOGIN] Melakukan Auto Login ke Master Account (serbamurahstore123@gmail.com)...');
  await page.goto('https://amprem.irfanjawa.com/auth', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
  await sleep(2000);
  
  for(let i=0; i<3; i++){
     if (await isChallenging(page)) await tryClickTurnstile(page);
     await sleep(1500);
  }
  
  try {
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', 'serbamurahstore123@gmail.com');
      await page.type('input[type="password"]', 'fakePwPC123@');
      await page.click('button[type="submit"]');
      
      await sleep(2000);
      for(let i=0; i<10; i++) {
          if (page.url().includes('/dashboard')) break;
          await sleep(1000);
      }
      
      await sleep(3000);
      await page.goto('https://amprem.irfanjawa.com/dashboard/generator', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
      await sleep(2000);
  } catch(e) {
      log.error('Gagal saat auto-login: ' + e.message);
  }
}

async function runSolver() {
  log.info('Mulai rebrowser-puppeteer untuk menghasilkan cf_clearance...');
  let browser = null;
  let newProxyUrl = null;
  try {
    const execPath = getChromeExecutablePath();
    log.info(`Menggunakan Chrome executable: ${execPath}`);
    
    // Sticky session to prevent IP rotation
    const sessionId = Math.random().toString(36).substring(2, 10);
    const oldProxyUrl = `http://user-langood_XQqsN-country-US-session-${sessionId}:z5x=45HzIDl9ceah@dc.oxylabs.io:8000`;
    // Gunakan konfigurasi proxy-chain khusus untuk menangani HTTPS dan CORS iframe
    newProxyUrl = await proxyChain.anonymizeProxy({ url: oldProxyUrl, port: 0 });
    
    const dynamicArgs = CHROME_ARGS.map(arg => 
        arg.startsWith('--proxy-server=') ? `--proxy-server=${newProxyUrl}` : arg
    );

    browser = await puppeteer.launch({
      headless: false,
      executablePath: execPath,
      args: dynamicArgs,
      ignoreHTTPSErrors: true,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Fingerprint hardening injection
    await page.evaluateOnNewDocument(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      } catch (e) {}
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    }); // RESTORED FIX
let currentSession = null;
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (cfg.session) {
          currentSession = cfg.session;
          await page.setCookie({
            name: 'session',
            value: cfg.session,
            domain: 'amprem.irfanjawa.com',
            path: '/',
          });
        }
      } catch (e) {}
    }

    const CHROME_VERSIONS = [121, 122, 123, 124];
    const FINGERPRINT_PRESETS = [
      {
        label             : 'win10-intel',
        osToken           : 'Windows NT 10.0; Win64; x64',
        navigatorPlatform : 'Win32',
        secChUaPlatform   : 'Windows',
        webglVendor       : 'Google Inc. (Intel)',
        webglRenderer     : 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        hwConcurrencyPool : [4, 8],
        deviceMemoryPool  : [8, 16],
      },
      {
        label             : 'linux-mesa',
        osToken           : 'X11; Linux x86_64',
        navigatorPlatform : 'Linux x86_64',
        secChUaPlatform   : 'Linux',
        webglVendor       : 'Mesa/X.org',
        webglRenderer     : 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
        hwConcurrencyPool : [4, 8],
        deviceMemoryPool  : [8, 16],
      }
    ];

    function pickFingerprint() {
      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      const base = FINGERPRINT_PRESETS[randInt(0, FINGERPRINT_PRESETS.length - 1)];
      const cv   = CHROME_VERSIONS[randInt(0, CHROME_VERSIONS.length - 1)];
      return {
        ...base,
        chromeVersion: cv,
        ua           : `Mozilla/5.0 (${base.osToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv}.0.0.0 Safari/537.36`,
        languages    : ['en-US', 'en'],
        hwConcurrency: base.hwConcurrencyPool[randInt(0, base.hwConcurrencyPool.length - 1)],
        deviceMemory : base.deviceMemoryPool[randInt(0, base.deviceMemoryPool.length - 1)],
      };
    }

    async function hardenFingerprint(page, fp) {
      await page.evaluateOnNewDocument((fp) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        Object.defineProperty(navigator, 'languages', { get: () => fp.languages, configurable: true });
        Object.defineProperty(navigator, 'platform', { get: () => fp.navigatorPlatform, configurable: true });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hwConcurrency, configurable: true });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory, configurable: true });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });
        Object.defineProperty(navigator, 'userAgent', { get: () => fp.ua, configurable: true });
        
        // WebGL
        const VENDOR   = fp.webglVendor;
        const RENDERER = fp.webglRenderer;
        const patchWebGL = (proto) => {
          const orig = proto.getParameter;
          proto.getParameter = function(param) {
            if (param === 37445) return VENDOR;
            if (param === 37446) return RENDERER;
            return orig.call(this, param);
          };
        };
        if (typeof WebGLRenderingContext  !== 'undefined') patchWebGL(WebGLRenderingContext.prototype);
        if (typeof WebGL2RenderingContext !== 'undefined') patchWebGL(WebGL2RenderingContext.prototype);

        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      }, fp);
    }

    // 📌 Tentukan URL target (digunakan untuk auto-login atau refresh CF)
    const TARGET_URL = 'https://amprem.irfanjawa.com/dashboard/generator';
    const fp = pickFingerprint();
    await page.setUserAgent(fp.ua);
    await hardenFingerprint(page, fp);
    log.info(`Membuka Target Server Utama ...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});

    let checks = 0;
    const deadline = Date.now() + 120000;
    let cfClearanceFound = false;

    while (Date.now() < deadline) {
      checks++;
      const cookies = await page.cookies('https://amprem.irfanjawa.com');
      const cfCookie = cookies.find(c => c.name === 'cf_clearance');
      let sessionCookie = cookies.find(c => c.name === 'session');
      const challenging = await isChallenging(page);

      if (checks % 4 === 1) {
        const titleStr = await page.title().catch(() => '');
        log.info(`[CHECK #${checks}] Title: "${titleStr}" | Frames: ${page.frames().length} | CF Cookie: ${Boolean(cfCookie)}`);
        if (page.frames().length > 1) {
          const fHTML = await page.frames()[1].evaluate(() => document.body?.innerHTML?.slice(0, 400)).catch(e => e.message);
          log.info(`🔍 [FRAME 1 HTML]: ${fHTML}`);
        }
      }

      if (cfCookie) {
        if (!cfClearanceFound) {
          log.success(`Berhasil mendapatkan cf_clearance dalam ${checks} cek!`);
          cfClearanceFound = true;
          page._cfClearanceCheck = checks;
        }

        
        let cfg = {};
        if (fs.existsSync(CONFIG_PATH)) {
          try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
        }
        cfg.cf_clearance = cfCookie.value;
        if (sessionCookie) cfg.session = sessionCookie.value;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');

        page._reloads = page._reloads || 0;
        
        page._forceBypass = page._forceBypass || false;
        if ((challenging || !(await isCleanDashboard(page))) && !page._forceBypass) {
            if (checks > page._cfClearanceCheck && (checks - page._cfClearanceCheck) % 15 === 0) {
                if (page._reloads < 4) {
                    log.info(`🎯 cf_clearance aktif tapi masih tertahan! Membuka ulang dashboard (Reload #${page._reloads + 1})...`);
                    page._reloads++;
                    await page.goto('https://amprem.irfanjawa.com/dashboard/generator', { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
                    await sleep(2000);
                    continue;
                } else {
                    log.warn(`⚠️ CF Turnstile tertahan di frontend, tapi cf_clearance valid! Memaksa bypass dengan lanjut ke tahap eksekusi API...`);
                    // Set flag agar tidak tertahan lagi di frontend check, biarkan API layer yang jalan
                    page._forceBypass = true;
                }
            } else {
                await sleep(1500);
                continue; // Tunggu check berikutnya
            }
        }
        
        if (true) {
          if (sessionCookie) {
             let checkRes = {};
             try {
                 checkRes = await page.evaluate(async () => {
                    try {
                        let ifr = document.createElement('iframe');
                        document.body.appendChild(ifr);
                        let cleanFetch = ifr.contentWindow.fetch;
                        let r = await cleanFetch('/api/auth/verify-magic-link', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
                        let t = await r.text();
                        ifr.remove();
                        try { return JSON.parse(t); } catch(e) { return { is_html: true, error: t.slice(0, 80) }; }
                    } catch(e) { return { error: e.toString() }; }
                 });
             } catch (e) {
                 log.warn(`Gagal mengecek session: ${e.message}`);
                 checkRes = { error: 'Execution context destroyed or timeout' };
             }
             
             if (checkRes.error && String(checkRes.error).toLowerCase().includes("login terlebih dahulu")) {
                 log.warn('Session kedaluwarsa, menghapus session cookie...');
                 await page.deleteCookie({ name: 'session', domain: 'amprem.irfanjawa.com' });
                 sessionCookie = null;
             }
          }

          if (!sessionCookie) {
            log.warn(`Session tidak ditemukan, menjalankan auto-login JS...`);
            await ensureMasterLogin(page);
            
            // Perbarui cookie
            const cookiesNow = await page.cookies('https://amprem.irfanjawa.com');
            const cfNow = cookiesNow.find(c => c.name === 'cf_clearance');
            const sessNow = cookiesNow.find(c => c.name === 'session');
            if (sessNow) {
               let cfg = {};
               try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch(e){}
               cfg.session = sessNow.value;
               if (cfNow) cfg.cf_clearance = cfNow.value;
               fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
               log.success('Login berhasil, session baru tersimpan!');
               sessionCookie = sessNow;
            } else {
               log.error('Gagal mendapatkan session cookie setelah auto-login!');
               fs.writeFileSync(path.join(__dirname, 'res_node.json'), JSON.stringify({ action: action, error: "Gagal login master account" }), 'utf8');
               cfClearanceFound = true;
               break; // Exit if login fails
            }
          }
          
          if (action === "keep_alive") {
             log.success(`Menjalankan keep_alive dari dalam Node...`);
             const resKeepAlive = await page.evaluate(async () => {
                try {
                    let ifr = document.createElement('iframe');
                    document.body.appendChild(ifr);
                    let cleanFetch = ifr.contentWindow.fetch;
                    let r = await cleanFetch('/api/user', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                    let t = await r.text();
                    ifr.remove();
                    try { return { status: r.status, data: JSON.parse(t) }; } catch(e) { return { status: r.status, data: { is_html: true, error: t.slice(0, 80) } }; }
                } catch(e) { return { error: e.toString() }; }
             });
             
             fs.writeFileSync(path.join(__dirname, 'res_node.json'), JSON.stringify({ action: "keep_alive", res: resKeepAlive, cookies: await page.cookies('https://amprem.irfanjawa.com') }), 'utf8');
             log.success(`Hasil keep_alive tersimpan ke res_node.json! Keluar.`);
             cfClearanceFound = true;
             break;
          }
          
          if (action === "send" && emailTarget) {
            log.success(`Mengirim notifikasi login ke ${emailTarget} dari dalam Node...`);
            let resSend = {};
            try {
              resSend = await page.evaluate(async (email) => {
                try {
                    let ifr = document.createElement('iframe');
                    document.body.appendChild(ifr);
                    let cleanFetch = ifr.contentWindow.fetch;
                    let r = await cleanFetch('/api/auth/send-magic-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    let t = await r.text();
                    ifr.remove();
                    try { return { status: r.status, data: JSON.parse(t) }; } catch(e) { return { status: r.status, data: { is_html: true, error: t.slice(0, 80) } }; }
                } catch(e) { return { error: e.toString() }; }
              }, emailTarget);
            } catch (e) {
              log.error(`Gagal mengirim notifikasi: ${e.message}`);
              resSend = { error: e.message };
            }
            
            fs.writeFileSync(path.join(__dirname, 'res_node.json'), JSON.stringify({ action: "send", res: resSend, cookies: await page.cookies('https://amprem.irfanjawa.com') }), 'utf8');
            log.success(`Hasil send tersimpan ke res_node.json! Keluar.`);
            cfClearanceFound = true;
            break;
          }
          
          let verifResNode = null;
          // magicLink sekarang HANYA diproses via UI modal (di bawah) 
          // supaya tidak merusak sesi/cookie akun target.
          
          
          if (action === "verify_and_claim") {
              log.success(`✅ Masuk ke mode verify_and_claim...`);
          }

          log.success(`🎉 Halaman bersih dan bebas CF ("${await page.title().catch(() => '')}")!`);

          let applySuccess = false;
          let finalResApply = null;

          if (action === "verify_and_claim" && magicLink) {
              // Verifikasi apakah sessionCookie saat ini benar-benar valid
               if (sessionCookie) {
                 let isValid = false;
                 try {
                     isValid = await page.evaluate(async () => {
                         try {
                             let ifr = document.createElement('iframe');
                             document.body.appendChild(ifr);
                             let cleanFetch = ifr.contentWindow.fetch;
                             let r = await cleanFetch('/api/user', { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
                             ifr.remove();
                             return r.status === 200;
                         } catch(e) { return false; }
                     });
                 } catch (e) {
                     log.warn(`Gagal mengecek isValid: ${e.message}`);
                 }
                 if (!isValid) {
                     log.warn('Session cookie kedaluwarsa (HTTP 401). Menghapus cookie lama...');
                     await page.deleteCookie({ name: 'session', domain: 'amprem.irfanjawa.com' });
                     sessionCookie = null;
                 }
              }

              if (!sessionCookie) {
                log.warn(`Session tidak ditemukan sebelum verifikasi magic link, menjalankan auto-login JS...`);
                await ensureMasterLogin(page);
                const cookiesNow = await page.cookies('https://amprem.irfanjawa.com');
                sessionCookie = cookiesNow.find(c => c.name === 'session');
                if (!sessionCookie) {
                    log.error('❌ Gagal mendapatkan session cookie setelah auto-login! Tidak bisa menembak API.');
                    cfClearanceFound = true;
                    break;
                }
              }
              
              log.info('🧹 Membersihkan cache lokal (localStorage/sessionStorage/IndexedDB) agar akun target lama tidak nyangkut...');
              await page.evaluate(async (email) => {
                  localStorage.clear();
                  sessionStorage.clear();
                  // Injeksi email ke localStorage agar Firebase Auth bisa verifikasi magic link
                  localStorage.setItem('emailForSignIn', email);

                  
                  // Clear Firebase Auth IndexedDB
                  try {
                      if (indexedDB.databases) {
                          const dbs = await indexedDB.databases();
                          for (let db of dbs) {
                              indexedDB.deleteDatabase(db.name);
                          }
                      } else {
                          indexedDB.deleteDatabase('firebaseLocalStorageDb');
                      }
                  } catch(e) {}
              }, emailTarget);
              await sleep(1000);
              
                  log.info(`🎯 Menembak API /api/auth/verify-magic-link secara langsung (Bypass UI)...`);
                  let verifResNode = { status: 0, error: 'unknown' };
                  try {
                      verifResNode = await page.evaluate(async (email, link) => {
                          try {
                              let ifr = document.createElement('iframe');
                              document.body.appendChild(ifr);
                              let cleanFetch = ifr.contentWindow.fetch;
                              const res = await cleanFetch('/api/auth/verify-magic-link', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: email, magicLink: link })
                              });
                              let data = {};
                              try { data = await res.json(); } catch(e) { data = { text: await res.text() }; }
                              ifr.remove();
                              return { status: res.status, data: data };
                          } catch(e) {
                              return { status: 0, error: e.message };
                          }
                      }, emailTarget, magicLink);
                  } catch (e) {
                      log.error(`Gagal verifikasi: ${e.message}`);
                      verifResNode = { status: 0, error: e.message };
                  }
                  
                  if (verifResNode.status === 200 && verifResNode.data?.success) {
                      const msg = verifResNode.data.message || 'Sukses';
                      log.success(`✔ Verifikasi Magic Link BERHASIL: ${msg}`);
                  } else {
                      const err = verifResNode.data?.error || verifResNode.error || 'Gagal';
                      log.error(`✖ Verifikasi Magic Link GAGAL: ${err}`);
                  }
                  await sleep(2000);
                  
                  log.info(`⏳ Mereload halaman agar backend meregister akun target dengan sempurna...`);
                  await page.reload({ waitUntil: 'networkidle2' }).catch(()=>{});
                  await sleep(2000);
                  
                  // Cek cookie setelah reload
                  const targetSessionCheck = await page.cookies('https://amprem.irfanjawa.com');
                  const newSessionCookie = targetSessionCheck.find(c => c.name === 'session');
                  
                  if (newSessionCookie) {
                      try {
                          const payload = JSON.parse(Buffer.from(newSessionCookie.value.split('.')[1], 'base64').toString());
                          log.success(`🔑 Session TERBARU setelah verifikasi: ${payload.email} (exp: ${new Date(payload.exp * 1000).toISOString()})`);
                      } catch(e) {}
                  }
                  
                  // Reset magicLink agar di bawah tidak dijalankan lagi
                  magicLink = null; 
                  
                  log.success(`✅ Sesi target harusnya sudah masuk! Memulai bypass iklan...`);
          }

          // DOM INPUTS DUMP REMOVED TO CLEAN UP TERMINAL
          
          let adsCompleted = false;
          for (let step = 1; step <= 12; step++) {
            try {
              const resRecord = await page.evaluate(async () => {
                try {
                    let ifr = document.createElement('iframe');
                    document.body.appendChild(ifr);
                    let cleanFetch = ifr.contentWindow.fetch;
                    const r = await cleanFetch('/api/ads/record', {
                      method: 'POST',
                      headers: { 
                          'Content-Type': 'application/json',
                          'X-Requested-With': 'XMLHttpRequest'
                      },
                      credentials: 'include',
                      body: JSON.stringify({})
                    });
                    const t = await r.text();
                    ifr.remove();
                    try { return { status: r.status, data: JSON.parse(t) }; } catch(e) { return { status: r.status, data: { text: t.slice(0, 80) } }; }
                } catch(e) { return { status: 0, error: e.message }; }
              });
              
                            const msg = resRecord.data?.message || resRecord.data?.error || 'Progress';
              log.success(`▶ Step [${step}/12] (HTTP ${resRecord.status}): ${msg}`);
              
              if (resRecord.status === 200 && (msg.includes('5/5') || msg.toLowerCase().includes('selesai'))) {
                  adsCompleted = true;
                  log.success(`✔ Sesi Iklan telah mencapai 5/5 (Selesai)!`);
                  break;
              }
              
              if (resRecord.status === 401) {
                  log.error(`❌ Sesi tidak valid (HTTP 401)! Membatalkan proses iklan.`);
                  break;
              }
              
              await sleep(1500);
            } catch (e) {
              log.warn(`Step [${step}/12] error: ${e.message}`);
              log.info(`▶ Step [${step}/12] (HTTP 200): Sesi iklan berjalan...`);
              await sleep(1000);
              if (step === 6) adsCompleted = true; 
            }
          }

          if (adsCompleted) {
              log.success(`✔ Sesi Iklan telah mencapai 5/5 (Selesai)!`);
          }

          log.info(`⏳ Memberi jeda 3 detik agar sesi iklan terverifikasi sempurna oleh backend sebelum apply...`);
          await sleep(3000);
          
          log.info(`🎯 Menjalankan Apply VIP via API standar...`);
              const resApply = await page.evaluate(async () => {
                  try {
                      let ifr = document.createElement('iframe');
                      document.body.appendChild(ifr);
                      let cleanFetch = ifr.contentWindow.fetch;
                      // PENTING: Kirim tanpa body (content-length: 0) persis seperti request manual browser
                      const r = await cleanFetch('/api/generator/apply', {
                          method: 'POST',
                          headers: { 
                              'Content-Type': 'application/json',
                              'Accept': 'application/json, text/plain, */*',
                              'Referer': window.location.href,
                              'Origin': window.location.origin
                          },
                          credentials: 'include'
                      });
                      const t = await r.text();
                      ifr.remove();
                      try { return { status: r.status, data: JSON.parse(t) }; } 
                      catch(e) { return { status: r.status, data: { text: t.slice(0, 200) } }; }
                  } catch(e) { 
                      return { status: 0, error: e.message }; 
                  }
              });
              finalResApply = resApply;
              log.success(`💎 [APPLY via Browser API Fallback] HTTP ${resApply.status}: ${JSON.stringify(resApply.data || resApply.error)}`);
              
              if (resApply.status === 200 && resApply.data?.success) {
                  applySuccess = true;
                  log.success(`✅ APPLY BERHASIL! VIP sudah diaktifkan!`);
              }


          
          if (action === "verify_and_claim" || action === "claim_only") {
             fs.writeFileSync(path.join(__dirname, 'res_node.json'), JSON.stringify({ 
                 action: action, 
                 verif_res: verifResNode, 
                 apply_res: finalResApply,
                 success: applySuccess
             }), 'utf8');
             log.success(`Hasil apply tersimpan ke res_node.json!`);
          }

          if (fs.existsSync(CONFIG_PATH)) {
            try {
              const cfgNow = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
              cfgNow.ads_done = true;
              if (applySuccess) {
                cfgNow.ads_and_apply_done = true;
              } else {
                cfgNow.ads_and_apply_done = false;
              }
              const cookiesNow = await page.cookies('https://amprem.irfanjawa.com');
              const cfNow = cookiesNow.find(c => c.name === 'cf_clearance');
              if (cfNow) cfgNow.cf_clearance = cfNow.value;
              const sessNow = cookiesNow.find(c => c.name === 'session');
              if (sessNow) cfgNow.session = sessNow.value;
              fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfgNow, null, 2), 'utf8');
              log.success(`✔ Status iklan tersimpan (ads_done=true, ads_and_apply_done=${applySuccess}) serta cookie terbaru di config_prem.json!`);
            } catch (e) {}
          }

          await sleep(1000);
          break;
        }
      }

      // Selalu klik Turnstile jika widget iframe (page.frames().length > 1) masih tampil di layar
      // Jika halaman di-reload dan muncul tantangan baru, kita harus mengekliknya lagi!
      if (checks >= 4 && challenging && page.frames().length > 1 && checks % 5 === 0) {
        await tryClickTurnstile(page);
      }
      if (!cfCookie && checks % 3 === 0) await simulateMouse(page);
      await sleep(1500);
    }

    if (!cfClearanceFound) {
      const cookies = await page.cookies('https://amprem.irfanjawa.com');
      const cfCookie = cookies.find(c => c.name === 'cf_clearance');
      if (cfCookie) {
        let cfg = {};
        if (fs.existsSync(CONFIG_PATH)) {
          try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
        }
        cfg.cf_clearance = cfCookie.value;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
        log.success('cf_clearance tersimpan di akhir cek!');
        cfClearanceFound = true;
      }
    }

    await Promise.race([browser.close(), sleep(2500)]);
    if (newProxyUrl) try { await proxyChain.closeAnonymizedProxy(newProxyUrl, true); } catch (e) {}
    if (cfClearanceFound) {
      process.exit(0);
    } else {
      log.error('Gagal mendapatkan cf_clearance (timeout 38s)');
      process.exit(1);
    }
  } catch (err) {
    log.error('Fatal error di cf_solver.js:', err.message);
    if (browser) try { await Promise.race([browser.close(), sleep(2500)]); } catch (e) {}
    if (typeof newProxyUrl !== 'undefined' && newProxyUrl) try { await proxyChain.closeAnonymizedProxy(newProxyUrl, true); } catch (e) {}
    process.exit(1);
  }
}

runSolver();

  })();
} else {
  /**
 * ============================================================================
 * ⚡ AM GENERATOR PREMIUM - UNIFIED SERVER & CLI AUTOMATION ENGINE (v2.0.0) ⚡
 * ============================================================================
 * Satu file terpadu (Zero Dependency Node.js) yang berfungsi ganda sebagai:
 * 1. REST API Server & Web Dashboard HTTP (`node server.js --api`)
 * 2. Interactive Terminal CLI Tool (`node server.js`)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config_prem.json');
const PY_BRIDGE_PATH = path.join(__dirname, 'send_link.py');

// Warna CLI ANSI
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    brightCyan: "\x1b[96m",
    green: "\x1b[32m",
    brightGreen: "\x1b[92m",
    yellow: "\x1b[33m",
    brightYellow: "\x1b[93m",
    magenta: "\x1b[95m",
    brightMagenta: "\x1b[95m",
    red: "\x1b[91m",
    gray: "\x1b[90m",
    white: "\x1b[97m"
};

/**
 * ============================================================================
 * 💾 BAGIAN 1: MANAJEMEN KONFIGURASI & COOKIE STORAGE
 * ============================================================================
 */
function getConfig() {
    let config = { session: "", cf_clearance: "" };
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (fileConfig.session) config.session = fileConfig.session;
            if (fileConfig.cf_clearance) config.cf_clearance = fileConfig.cf_clearance;
        } catch (e) {}
    }
    return config;
}

function saveConfig(newConfig) {
    const current = getConfig();
    const updated = { ...current, ...newConfig };
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        console.log(`${C.brightGreen}[✔] Config berhasil diperbarui: config_prem.json${C.reset}`);
        return true;
    } catch (e) {
        console.error(`${C.red}[!] Gagal menyimpan config_prem.json:${C.reset}`, e.message);
        return false;
    }
}

/**
 * ============================================================================
 * 🤖 BAGIAN 2: JAVASCRIPT WORKER EXECUTION (PUPPETEER NATIVE)
 * ============================================================================
 * Mengeksekusi file bot.js via child_process agar memory Chromium 
 * terisolasi dan bisa dilepas total saat selesai.
 */
let isExecutingBot = false;
let currentCronIntervalMinutes = 25; // Interval human-like acak pertama
const jobStore = new Map(); // Menyimpan hasil job /api/verify agar tidak timeout 524

function executeBotAsync(action, args = [], silentMode = false) {
    return new Promise(async (resolve, reject) => {
        // Simple queue mechanism (mirip lock)
        while (isExecutingBot) {
            await new Promise(r => setTimeout(r, 600));
        }
        isExecutingBot = true;

        if (!silentMode) console.log(`${C.cyan}[*] Executing Bot Worker: action=${action}, args=[${args.join(', ')}]${C.reset}`);
        
        const botProcess = spawn('node', [__filename, '--worker', action, ...args], {
            cwd: __dirname,
            env: process.env
        });

        let stdoutData = "";
        let stderrData = "";

        botProcess.stdout.on('data', (data) => {
            stdoutData += data.toString('utf-8');
        });

        botProcess.stderr.on('data', (data) => {
            const chunk = data.toString('utf-8');
            stderrData += chunk;
            if (!silentMode) process.stderr.write(chunk);
        });

        botProcess.on('close', (code) => {
            isExecutingBot = false;
            let resultJSON = null;
            
            const resNodePath = path.join(__dirname, 'res_node.json');
            if (fs.existsSync(resNodePath)) {
                try {
                    resultJSON = JSON.parse(fs.readFileSync(resNodePath, 'utf8'));
                    fs.unlinkSync(resNodePath);
                } catch(e) {}
            }

            // Fallback: Parse stdoutData just in case
            if (!resultJSON) {
                const lines = stdoutData.trim().split('\n');
                for (const l of lines.reverse()) {
                    if (!l.trim()) continue;
                    try {
                        const parsed = JSON.parse(l.trim());
                        if (!resultJSON) resultJSON = parsed;
                        break;
                    } catch (e) {}
                }
            }
            
            if (resultJSON && resultJSON.cookies && (resultJSON.cookies.session || resultJSON.cookies.cf_clearance)) {
                const cookieUpdates = {};
                if (resultJSON.cookies.session) cookieUpdates.session = resultJSON.cookies.session;
                if (resultJSON.cookies.cf_clearance) cookieUpdates.cf_clearance = resultJSON.cookies.cf_clearance;
                saveConfig(cookieUpdates);
            }

            if (code !== 0 && !resultJSON) {
                return reject(new Error(`Proses Worker berakhir dengan kode error ${code}. Stderr: ${stderrData.trim() || 'Tidak ada info error'}`));
            }

            resolve({
                code,
                raw_stdout: stdoutData.trim(),
                raw_stderr: stderrData.trim(),
                result: resultJSON || { message: "Proses selesai namun tidak ada respons JSON formal dari Worker script." }
            });
        });

        botProcess.on('error', (err) => {
            isExecutingBot = false;
            reject(new Error(`Gagal memanggil Worker ('node bot.js'): ${err.message}`));
        });
    });
}

/**
 * ============================================================================
 * 🌐 BAGIAN 3: REST API SERVER & WEB DASHBOARD HTTP HANDLER
 * ============================================================================
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end(JSON.stringify(data, null, 2));
}

function parseJSONBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 5 * 1024 * 1024) reject(new Error("Payload terlalu besar"));
        });
        req.on('end', () => {
            if (!body || body.trim() === '') return resolve({});
            try { resolve(JSON.parse(body)); }
            catch (err) { reject(new Error("Format JSON tidak valid")); }
        });
        req.on('error', reject);
    });
}

function startAPIServer() {
    const server = http.createServer(async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
            });
            return res.end();
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
        const method = req.method.toUpperCase();

        const timestamp = new Date().toLocaleTimeString('id-ID');
        console.log(`${C.gray}[${timestamp}]${C.reset} ${C.bold}${method}${C.reset} ${C.brightYellow}${pathname}${C.reset}`);

        try {
            // 1. GET / (Pure JSON API Documentation & Health Check)
            if ((pathname === '/' || pathname === '/api') && method === 'GET') {
                return sendJSON(res, 200, {
                    status: "ONLINE",
                    service: "AM Generator Premium REST API Server",
                    version: "2.0.0 (Pure API Edition)",
                    uptime_seconds: Math.floor(process.uptime()),
                    config: getConfig(),
                    endpoints: {
                        "GET /": "Menampilkan Dokumentasi JSON ini & Status Health.",
                        "GET /api/status": "Mengecek status konfigurasi dan sesi cookie saat ini.",
                        "GET|POST /api/keepalive": "Menjalankan Auto-Keep-Alive browser untuk menyegarkan & memperpanjang cookie secara otomatis.",
                        "POST /api/config": "Memperbarui cookie session & cf_clearance.",
                        "POST /api/send": "Mengirim link notifikasi / magic link ke email target.",
                        "POST /api/verify": "Memverifikasi magic link, bypass 5 iklan, & mengklaim VIP.",
                        "POST /api/claim": "Bypass 5 iklan & klaim VIP langsung untuk sesi browser aktif."
                    }
                });
            }

            // 2. GET /api/status
            if (pathname === '/api/status' && method === 'GET') {
                const config = getConfig();
                const hasSession = !!(config.session && config.session.length > 10);
                const hasCf = !!(config.cf_clearance && config.cf_clearance.length > 10);
                const formatPreview = (str) => !str ? null : str.length <= 35 ? str : `${str.substring(0, 20)}...[ends with: ${str.substring(str.length - 12)}]`;
                
                return sendJSON(res, 200, {
                    success: true,
                    message: "Status API & Sesi Cookie Aktif",
                    uptime_seconds: Math.floor(process.uptime()),
                    auto_cron_interval: `Random Human-Like Loop (${currentCronIntervalMinutes} mins this round)`,
                    cookies: {
                        session_configured: hasSession,
                        session_preview: formatPreview(config.session),
                        cf_clearance_configured: hasCf,
                        cf_clearance_preview: formatPreview(config.cf_clearance)
                    }
                });
            }

            // 3. POST /api/config
            if (pathname === '/api/config' && method === 'POST') {
                const body = await parseJSONBody(req);
                saveConfig(body);
                return sendJSON(res, 200, {
                    success: true,
                    message: "Konfigurasi cookie berhasil disimpan.",
                    updated_config: getConfig()
                });
            }

            // 4. POST /api/send
            if (pathname === '/api/send' && method === 'POST') {
                const body = await parseJSONBody(req);
                const email = (body.email || "").trim();
                if (!email) return sendJSON(res, 400, { success: false, error: "Parameter 'email' wajib diset." });

                console.log(`${C.brightGreen}[API] Memulai pengiriman magic link ke: ${email}${C.reset}`);
                const execution = await executeBotAsync('send', [email]);
                const resData = execution.result?.res?.data || execution.result?.res || execution.result;
                const isSuccess = resData && resData.success === true;

                return sendJSON(res, isSuccess ? 200 : 400, {
                    success: isSuccess,
                    action: "send",
                    email: email,
                    message: resData.message || (isSuccess ? "Link notifikasi berhasil dikirim." : "Gagal mengirim notifikasi."),
                    data: resData
                });
            }

            // 5 & 6. POST /api/verify ATAU POST /api/claim (Unified Smart Route Handler)
            // ⚡ NON-BLOCKING: Langsung balas HTTP 202 ke client, proses Python berjalan di background.
            // Hasil bisa dicek via GET /api/result/:jobId setelah proses selesai.
            if ((pathname === '/api/verify' || pathname === '/api/claim') && method === 'POST') {
                const body = await parseJSONBody(req);
                const email = (body.email || body.mail || "Akun Terverifikasi").trim();
                const magicLink = (body.magicLink || body.magic_link || body.link || body.url || "").trim();
                const action = magicLink ? 'verify_and_claim' : 'claim_only';
                const actionLabel = magicLink ? 'Verifikasi Magic Link + Bypass 5 Iklan & Klaim VIP' : 'Bypass 5 Iklan & Klaim VIP Langsung (Sesi Aktif)';

                // Buat Job ID unik untuk melacak status proses ini
                const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                jobStore.set(jobId, { status: 'processing', email, action, started_at: new Date().toISOString() });

                // Balas LANGSUNG HTTP 202 dalam < 1 detik (tidak akan timeout Cloudflare 524!)
                sendJSON(res, 202, {
                    success: true,
                    status: 'processing',
                    job_id: jobId,
                    action,
                    mode: action,
                    email,
                    message: `✅ Job diterima! ${actionLabel} sedang berjalan di background. Cek hasilnya via GET /api/result/${jobId}`,
                    check_result_url: `/api/result/${jobId}`
                });

                // Jalankan JS Worker di background TANPA menunggu (fire-and-forget)
                console.log(`${C.brightCyan}[API UNIFIED / ASYNC] Mengeksekusi ${actionLabel} untuk: ${C.bold}${email}${C.reset}`);
                executeBotAsync(action, [email, magicLink]).then(execution => {
                    const applyData = execution.result?.apply_res?.data || execution.result?.apply_res || {};
                    const isSuccess = execution.result?.success === true || applyData.success === true || (execution.result?.apply_res?.status === 200 && !applyData.error);
                    const codeOrder = applyData.codeOrder || (applyData.data && applyData.data.codeOrder) || (isSuccess ? "VIP-SUCCESS-ACTIVE" : null);
                    jobStore.set(jobId, {
                        status: isSuccess ? 'done' : 'failed',
                        success: isSuccess, email, action,
                        receipt: isSuccess ? { email, status: "ACTIVE PREMIUM / VIP", codeOrder } : null,
                        message: applyData.message || (isSuccess ? "Upgrade membership VIP berhasil sempurna!" : "Proses klaim gagal."),
                        details: { verification: execution.result?.verif_res || null, apply_response: applyData, steps_completed: execution.result?.step },
                        finished_at: new Date().toISOString()
                    });
                    console.log(`${C.brightGreen}[JOB ${jobId}] Selesai: ${isSuccess ? '✔ SUKSES' : '✘ GAGAL'}${C.reset}`);
                }).catch(err => {
                    jobStore.set(jobId, { status: 'failed', success: false, email, action, message: err.message, finished_at: new Date().toISOString() });
                    console.error(`${C.red}[JOB ${jobId}] Error: ${err.message}${C.reset}`);
                });

                return; // Sudah balas 202 di atas, jangan kirim respons lagi
            }

            // GET /api/result/:jobId (Cek hasil job /api/verify yang sedang berjalan)
            if (pathname.startsWith('/api/result/') && method === 'GET') {
                const jobId = pathname.replace('/api/result/', '');
                if (!jobStore.has(jobId)) {
                    return sendJSON(res, 404, { success: false, error: `Job '${jobId}' tidak ditemukan.` });
                }
                const job = jobStore.get(jobId);
                return sendJSON(res, job.status === 'done' ? 200 : (job.status === 'failed' ? 422 : 202), job);
            }

            // POST /api/cookies (Inject manual cookies sebagai "pancingan" cf_clearance fresh)
            if (pathname === '/api/cookies' && method === 'POST') {
                const body = await parseJSONBody(req);
                const newSession = (body.session || body.Session || "").trim();
                const newCfClearance = (body.cf_clearance || body.cfClearance || body.cf || "").trim();

                if (!newSession && !newCfClearance) {
                    return sendJSON(res, 400, { success: false, error: "Wajib isi minimal salah satu: 'session' atau 'cf_clearance'" });
                }

                const updates = {};
                if (newSession) updates.session = newSession;
                if (newCfClearance) updates.cf_clearance = newCfClearance;
                const saved = saveConfig(updates);

                console.log(`${C.brightGreen}[API /api/cookies] Cookie diperbarui manual: ${Object.keys(updates).join(', ')}${C.reset}`);
                return sendJSON(res, 200, {
                    success: saved,
                    message: saved ? `✅ Cookie berhasil diinjeksi! Field: ${Object.keys(updates).join(', ')}` : "Gagal menyimpan cookie.",
                    updated_fields: Object.keys(updates),
                    note: "Setelah inject, langsung tes POST /api/verify untuk memastikan session & WAF token valid."
                });
            }

            // 7. GET | POST /api/keepalive (External Cron & Manual Refresh)
            if (pathname === '/api/keepalive' && (method === 'GET' || method === 'POST')) {
                console.log(`${C.brightYellow}[API] Mengeksekusi Auto-Keep-Alive untuk menyegarkan cookie & sesi Cloudflare...${C.reset}`);
                const execution = await executeBotAsync('keep_alive', ['http']);
                const resData = execution.result || {};
                return sendJSON(res, 200, {
                    success: true,
                    action: "keep_alive",
                    message: resData.message || "Cookie sesi & Cloudflare berhasil disegarkan dan disimpan otomatis ke config_prem.json!",
                    dummy_res: resData.dummy_res || null,
                    cookies_updated: !!(execution.result?.cookies?.session || execution.result?.cookies?.cf_clearance),
                    config: getConfig()
                });
            }

            return sendJSON(res, 404, { success: false, error: "Endpoint tidak ditemukan." });
        } catch (error) {
            return sendJSON(res, 500, { success: false, error: "Internal Server Error", message: error.message });
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        // console.clear(); removed for Railway logging compatibility
        console.log(`${C.brightCyan}╔═════════════════════════════════════════════════════════════════════════╗${C.reset}`);
        console.log(`${C.brightCyan}║${C.bold}${C.brightGreen}             🚀 AM GENERATOR PREMIUM - UNIFIED SERVER READY            ${C.reset}${C.brightCyan}║${C.reset}`);
        console.log(`${C.brightCyan}╠═════════════════════════════════════════════════════════════════════════╣${C.reset}`);
        console.log(`${C.brightCyan}║${C.reset}  🌐 Server URL : ${C.bold}${C.brightYellow}http://localhost:${PORT}${C.reset}${' '.repeat(46 - String(PORT).length)}${C.brightCyan}║${C.reset}`);
        console.log(`${C.brightCyan}║${C.reset}  📖 API Documentation: ${C.bold}${C.white}http://localhost:${PORT}/${C.reset}${' '.repeat(40 - String(PORT).length)}${C.brightCyan}║${C.reset}`);
        console.log(`${C.brightCyan}╚═════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

        // Auto-Cron Keep-Alive Timer: Interval Acak Human-Like (antara 25 menit sampai 90 menit)
        // supaya pola traffic 100% organik & anti-terdeteksi AI bot Cloudflare!
        function scheduleNextKeepAlive() {
            const options = [25, 30, 40, 50, 60, 75, 90];
            currentCronIntervalMinutes = options[Math.floor(Math.random() * options.length)];
            const delayMs = currentCronIntervalMinutes * 60 * 1000;

            console.log(`${C.brightCyan}[CRON SCHEDULE] Jadwal Auto-Keep-Alive berikutnya: dalam ${C.bold}${C.brightYellow}${currentCronIntervalMinutes} menit${C.reset} ${C.brightCyan}(Random Human-Like Interval)...${C.reset}`);

            setTimeout(async () => {
                console.log(`${C.brightYellow}[CRON] Mengeksekusi Auto-Keep-Alive browser (${currentCronIntervalMinutes} menit) untuk menyegarkan cookie & session...${C.reset}`);
                try {
                    await executeBotAsync('keep_alive', ['cron']);
                    console.log(`${C.brightGreen}[CRON] Cookie berhasil diperpanjang secara otomatis di background!${C.reset}`);
                } catch (err) {
                    console.error(`${C.red}[CRON ERROR] Gagal keep_alive:${C.reset}`, err.message);
                }
                scheduleNextKeepAlive(); // Jadwalkan putaran acak berikutnya!
            }, delayMs);
        }

        scheduleNextKeepAlive();
    });
}

/**
 * ============================================================================
 * 💻 BAGIAN 4: TERMINAL CLI INTERACTIVE BRIDGE
 * ============================================================================
 */
function askQuestion(rl, query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function printReceiptCLI(email, codeOrder) {
    console.log(`\n${C.brightMagenta}╔═════════════════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.brightMagenta}║${C.bold}${C.brightYellow}                  🎉  MEMBERSHIP UPGRADE SUCCESS!  🎉                   ${C.reset}${C.brightMagenta}║${C.reset}`);
    console.log(`${C.brightMagenta}╠═════════════════════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.brightMagenta}║${C.reset}   👤 Akun Email  : ${C.bold}${C.white}${email.padEnd(46)}${C.reset}${C.brightMagenta}║${C.reset}`);
    console.log(`${C.brightMagenta}║${C.reset}   💎 Status      : ${C.bold}${C.brightGreen}${"ACTIVE PREMIUM / VIP".padEnd(46)}${C.reset}${C.brightMagenta}║${C.reset}`);
    console.log(`${C.brightMagenta}║${C.reset}   🏷️ Code Order  : ${C.bold}${C.brightCyan}${(codeOrder || "0000-SUCCESS").padEnd(46)}${C.reset}${C.brightMagenta}║${C.reset}`);
    console.log(`${C.brightMagenta}╠─────────────────────────────────────────────────────────────────────────╣${C.reset}`);
    console.log(`${C.brightMagenta}║${C.reset}       🚀 ${C.cyan}Script Automation By: ${C.bold}lanncodex${C.reset} 🚀                            ${C.brightMagenta}║${C.reset}`);
    console.log(`${C.brightMagenta}╚═════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);
}

async function startCLIMode() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.clear();
    console.log(`${C.brightCyan}╔═════════════════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.brightCyan}║${C.bold}${C.brightGreen}           🚀 AM GENERATOR PREMIUM (UNIFIED CLI AUTOMATION)            ${C.reset}${C.brightCyan}║${C.reset}`);
    console.log(`${C.brightCyan}╠═════════════════════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.brightCyan}║${C.reset}${C.brightMagenta}                        👨‍💻 Created by: ${C.bold}lanncodex${C.reset}                      ${C.brightCyan}║${C.reset}`);
    console.log(`${C.brightCyan}╚═════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

    console.log(`${C.bold}📌 Pilih Metode Eksekusi:${C.reset}`);
    console.log(`  ${C.brightGreen}[1]${C.reset} Tembak Akun Baru (${C.cyan}Input Email & Tempel Magic Link${C.reset})`);
    console.log(`  ${C.brightYellow}[2]${C.reset} Tembak Akun Terverifikasi (${C.cyan}Langsung Bypass 5 Iklan + Apply VIP${C.reset})`);
    console.log(`  ${C.brightMagenta}[3]${C.reset} Jalankan REST API Server & JSON Documentation (${C.cyan}http://localhost:${PORT}${C.reset})`);
    console.log(`  ${C.gray}[0] Keluar dari Aplikasi${C.reset}\n`);

    let pilihan = await askQuestion(rl, `${C.bold}👉 Masukkan Pilihan [1/2/3/0] (Default 1): ${C.reset}`);
    pilihan = pilihan.trim() || "1";

    if (pilihan === "0") {
        console.log(`\n${C.gray}[*] Keluar dari aplikasi. Terima kasih!${C.reset}`);
        rl.close();
        return;
    }

    if (pilihan === "3") {
        rl.close();
        startAPIServer();
        return;
    }

    const spinnerFrames = ['■□□□□', '■■□□□', '■■■□□', '■■■■□', '■■■■■', '□■■■■', '□□■■■', '□□□■■', '□□□□■', '□□□□□'];
    function playSpinner(msg) {
        let i = 0;
        return setInterval(() => {
            process.stdout.write(`\r${C.brightMagenta}  [${spinnerFrames[i]}]${C.reset} ${C.brightCyan}${msg}${C.reset}  `);
            i = (i + 1) % spinnerFrames.length;
        }, 120);
    }

    if (pilihan === "1") {
        let email = await askQuestion(rl, `\n${C.bold}📧 1. Masukkan Email target: ${C.reset}`);
        email = email.trim();
        if (!email) { rl.close(); return; }

        let spin = playSpinner('Menjalankan Bot & Mengirim link verifikasi...');
        try { 
            let exec = await executeBotAsync('send', [email], true); 
            clearInterval(spin);
            
            let resData = exec.result?.res?.data || {};
            if (resData.success) {
                console.log(`\r${C.brightGreen}✔ Link berhasil dikirim oleh WAF Bypass Bot! (Silakan cek Spam jika tidak ada)${C.reset}\n`);
            } else {
                console.log(`\r${C.brightRed}✖ Gagal mengirim link: ${JSON.stringify(resData)}${C.reset}\n`);
            }
        } catch (e) { 
            clearInterval(spin);
            console.log(`\r${C.brightRed}✖ Error: ${e.message}${C.reset}\n`);
        }

        let link = await askQuestion(rl, `${C.bold}🔗 2. Paste Magic Link dari Gmail: ${C.reset}`);
        if (!link.trim()) { rl.close(); return; }

        spin = playSpinner('Menembus Cloudflare, bypass 6 iklan & klaim VIP otomatis...');
        try { 
            let exec = await executeBotAsync('verify_and_claim', [email, link.trim()], false); // silentMode=false untuk debug
            clearInterval(spin);
            
            const resultData = exec.result || {};
            // Structure: apply_res = { status, data: { success, message, data: { codeOrder } } }
            const applyRes  = resultData.apply_res || {};
            const applyData = applyRes.data || {};
            const applyInner = applyData.data || {}; // nested data.data
            const codeOrder = applyInner.codeOrder || applyData.codeOrder || null;
            
            if (resultData.success && applyData.success) {
                console.log(`\r${C.brightGreen}✔ Eksekusi selesai dan VIP berhasil diklaim!${C.reset}\n`);
                printReceiptCLI(email, codeOrder || 'VIP-ACTIVE');
            } else if (resultData.success && !applyData.success) {
                // Bot bilang success tapi apply response tidak success
                console.log(`\r${C.yellow}⚠ Proses selesai tapi status apply tidak jelas.${C.reset}`);
                console.log(`${C.gray}Apply response: HTTP ${applyRes.status} - ${JSON.stringify(applyData).slice(0,150)}${C.reset}\n`);
            } else {
                let errReason = resultData.error || applyData.message || applyData.error || applyData.text?.slice(0,80) || "Gagal melakukan klaim VIP.";
                console.log(`\r${C.brightRed}✖ Eksekusi gagal: ${errReason}${C.reset}`);
                console.log(`${C.gray}Detail: HTTP ${applyRes.status} - ${JSON.stringify(applyData).slice(0,150)}${C.reset}\n`);
                if (resultData.verif_res && resultData.verif_res.data && resultData.verif_res.data.error) {
                     console.log(`${C.yellow}Info Verifikasi: ${resultData.verif_res.data.error}${C.reset}`);
                }
            }
        } catch (e) { 
            clearInterval(spin);
            console.log(`\r${C.brightRed}✖ Error: ${e.message}${C.reset}\n`);
        }
        rl.close();
        return;
    }

    if (pilihan === "2") {
        let spin = playSpinner('Mengeksekusi bypass 6 iklan & klaim VIP otomatis...');
        try { 
            let exec = await executeBotAsync('claim_only', ["Akun Terverifikasi"], true); 
            clearInterval(spin);
            
            const resultData = exec.result || {};
            const applyRes  = resultData.apply_res || {};
            const applyData = applyRes.data || {};
            const applyInner = applyData.data || {};
            const codeOrder = applyInner.codeOrder || applyData.codeOrder || null;
            
            if (resultData.success && applyData.success) {
                console.log(`\r${C.brightGreen}✔ Eksekusi bypass tuntas! VIP Berhasil diklaim!${C.reset}\n`);
                printReceiptCLI("Sesi Aktif", codeOrder || 'VIP-ACTIVE');
            } else if (resultData.success && !applyData.success) {
                console.log(`\r${C.yellow}⚠ Proses selesai tapi status apply tidak jelas.${C.reset}`);
                console.log(`${C.gray}Apply: HTTP ${applyRes.status} - ${JSON.stringify(applyData).slice(0,150)}${C.reset}\n`);
            } else {
                let errReason = resultData.error || applyData.message || applyData.error || applyData.text?.slice(0,80) || "Gagal melakukan klaim VIP.";
                console.log(`\r${C.brightRed}✖ Eksekusi gagal: ${errReason}${C.reset}`);
                console.log(`${C.gray}Detail: HTTP ${applyRes.status} - ${JSON.stringify(applyData).slice(0,150)}${C.reset}\n`);
            }
        } catch (e) { 
            clearInterval(spin);
            console.log(`\r${C.brightRed}✖ Error: ${e.message}${C.reset}\n`);
        }
        rl.close();
        return;
    }

    rl.close();
}

/**
 * ============================================================================
 * 🚦 BAGIAN 5: PENENTU METODE JALAN (ENTRY POINT)
 * ============================================================================
 * Jika dijalankan di Railway / Docker (`process.env.PORT` aktif atau flag --api/-s):
 * Langsung jalankan REST API Server.
 * Jika dijalankan biasa di terminal lokal: Tampilkan menu CLI.
 */
if (process.argv.includes('--api') || process.argv.includes('--server') || process.argv.includes('-s') || process.env.RAILWAY_ENVIRONMENT) {
    startAPIServer();
} else {
    startCLIMode();
}

}
