const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Konfigurasi Base URL
const BASE_URL = "https://kim-atlas-keyword-prev.trycloudflare.com";

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("==========================================");
    console.log("      KIM ATLAS AUTO VIP - CLIENT JS      ");
    console.log("==========================================\n");

    try {
        // 1. Input Email
        const email = await askQuestion("Masukkan Email Anda: ");
        if (!email.trim()) {
            console.log("[-] Email tidak boleh kosong!");
            rl.close();
            return;
        }

        console.log(`\n[*] Mengirim request ke ${BASE_URL}/api/send...`);
        
        // 2. Request ke /api/send
        const sendResponse = await fetch(`${BASE_URL}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email.trim() })
        });

        // Coba parsing response sebagai JSON, jika gagal fallback ke text
        let sendResult;
        try {
            sendResult = await sendResponse.json();
        } catch (e) {
            sendResult = await sendResponse.text();
        }
        
        if (sendResponse.ok) {
            console.log("[+] Berhasil meminta magic link!");
            if (sendResult.message) {
                console.log(`[i] Pesan dari server: ${sendResult.message}`);
            } else {
                console.dir(sendResult, { depth: null, colors: true });
            }
        } else {
            console.log("[-] Gagal meminta magic link.");
            console.log(`[i] Status: ${sendResponse.status}`);
            console.dir(sendResult, { depth: null, colors: true });
            rl.close();
            return;
        }

        console.log("\n[*] Silakan cek kotak masuk (inbox) atau spam email Anda untuk mendapatkan Magic Link.");
        
        // 3. Input Magic Link
        const magicLink = await askQuestion("Masukkan / Paste Magic Link yang didapat: ");

        if (!magicLink.trim()) {
            console.log("[-] Magic link tidak boleh kosong!");
            rl.close();
            return;
        }

        console.log(`\n[*] Memverifikasi Magic Link ke ${BASE_URL}/api/verify...`);
        console.log(`[*] Mohon tunggu, proses bypass iklan dan klaim VIP sedang berjalan...\n`);

        // 4. Request ke /api/verify
        const verifyResponse = await fetch(`${BASE_URL}/api/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: email.trim(), 
                magicLink: magicLink.trim() 
            })
        });

        let verifyResult;
        try {
            verifyResult = await verifyResponse.json();
        } catch (e) {
            verifyResult = await verifyResponse.text();
        }

        // 5. Menampilkan hasil verifikasi awal dan Polling Job
        console.log("==========================================");
        if (verifyResponse.ok) {
            console.log("    [+] JOB VERIFIKASI DITERIMA [+]");
            console.log("==========================================");
            console.log("Pesan Server:", verifyResult.message || "Sedang memproses...");
            
            // Jika ada jobId, kita lakukan polling (ngecek terus ke server)
            if (verifyResult.job_id) {
                console.log(`\n[*] Memantau status Job ID: ${verifyResult.job_id}`);
                process.stdout.write("[*] Loading");
                
                let isDone = false;
                while (!isDone) {
                    await new Promise(r => setTimeout(r, 3000)); // Jeda 3 detik
                    
                    try {
                        const jobRes = await fetch(`${BASE_URL}/api/result/${verifyResult.job_id}`);
                        const jobData = await jobRes.json();
                        
                        // Cek apakah status sudah berubah dari processing
                        if (jobData.data && jobData.data.status !== 'processing') {
                            isDone = true;
                            console.log("\n\n==========================================");
                            if (jobData.data.success) {
                                console.log("    [+] PROSES VIP BERHASIL! [+]");
                            } else {
                                console.log("    [-] PROSES VIP GAGAL! [-]");
                            }
                            console.log("==========================================");
                            console.log("Detail Akhir:");
                            console.dir(jobData.data, { depth: null, colors: true });
                        } else {
                            // Tampilkan titik-titik indikator loading
                            process.stdout.write(".");
                        }
                    } catch (err) {
                        isDone = true;
                        console.log("\n[!] Gagal mengecek status job:", err.message);
                    }
                }
            } else {
                // Jika tidak ada job_id, langsung tampilkan
                console.dir(verifyResult, { depth: null, colors: true });
            }
        } else {
            console.log("    [-] VERIFIKASI DITOLAK! [-]");
            console.log("==========================================");
            console.log(`Status HTTP: ${verifyResponse.status}`);
            console.log("Detail Respons:");
            console.dir(verifyResult, { depth: null, colors: true });
        }

    } catch (error) {
        console.error("\n[!] Terjadi kesalahan sistem:", error.message);
        console.error("Pastikan Anda menggunakan Node.js versi 18+ (yang mendukung fetch) atau periksa koneksi internet Anda.");
    } finally {
        rl.close();
    }
}

main();
