const http = require('http');
const { getConfig, saveConfig } = require('./config');
const { executeBotAsync, jobStore } = require('./executor');
const { C } = require('./utils');
const { Resend } = require('resend');

const resend = new Resend('re_FVxyQuXu_DX36XEs5bnzw91stjKmpku5R');
const PORT = process.env.PORT || 3000;
let currentCronIntervalMinutes = 25;

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

                    if (isSuccess && email && email !== "Akun Terverifikasi") {
                        console.log(`${C.brightCyan}[EMAIL] Mengirim notifikasi Premium ke ${email}...${C.reset}`);
                        resend.emails.send({
                            from: 'AM Generator Premium <onboarding@resend.dev>',
                            to: email,
                            subject: '🎉 Selamat! Akun Kamu Sekarang Premium',
                            html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
                                <h2 style="color: #28a745; text-align: center;">Upgrade VIP Berhasil! 💎</h2>
                                <p>Halo,</p>
                                <p>Sistem otomatis kami telah sukses melakukan bypass antrean iklan dan secara resmi mengaktifkan status <strong>Premium/VIP</strong> di akun kamu.</p>
                                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>📧 Email Akun:</strong> ${email}</p>
                                    <p style="margin: 5px 0;"><strong>🏷️ Order Code:</strong> ${codeOrder}</p>
                                </div>
                                <p>Silakan buka dan login kembali ke dalam aplikasi untuk menikmati semua fitur premium tanpa batasan apa pun.</p>
                                <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;" />
                                <p style="font-size: 12px; color: #888; text-align: center;">Pesan ini dikirim secara otomatis oleh AM Generator Bot Automation.<br>API Powered by Resend.</p>
                            </div>`
                        }).then(() => console.log(`${C.brightGreen}[EMAIL] Notifikasi sukses terkirim ke ${email}${C.reset}`))
                          .catch(e => console.error(`${C.red}[EMAIL ERROR] Gagal mengirim ke ${email}: ${e.message}${C.reset}`));
                    }

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

module.exports = { startAPIServer };