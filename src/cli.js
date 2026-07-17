const readline = require('readline');
const { startAPIServer } = require('./server');
const { executeBotAsync } = require('./executor');
const { C } = require('./utils');
const PORT = process.env.PORT || 3000;

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

module.exports = { startCLIMode };