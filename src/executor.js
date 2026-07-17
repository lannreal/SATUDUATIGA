const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { saveConfig } = require('./config');
const { C } = require('./utils');

let isExecutingBot = false;
const jobStore = new Map();

function executeBotAsync(action, args = [], silentMode = false) {
    return new Promise(async (resolve, reject) => {
        while (isExecutingBot) {
            await new Promise(r => setTimeout(r, 600));
        }
        isExecutingBot = true;

        if (!silentMode) console.log(`${C.cyan}[*] Executing Bot Worker: action=${action}, args=[${args.join(', ')}]${C.reset}`);
        
        const botPath = path.join(__dirname, 'bot.js');
        const isLinux = process.platform === 'linux';
        const spawnCmd = isLinux ? 'xvfb-run' : 'node';
        const spawnArgs = isLinux ? ['--auto-servernum', '--server-args=-screen 0, 1920x1080x24', 'node', botPath, action, ...args] : [botPath, action, ...args];
        
        const botProcess = spawn(spawnCmd, spawnArgs, {
            cwd: path.join(__dirname, '..'),
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
            
            const resNodePath = path.join(__dirname, '..', 'res_node.json');
            if (fs.existsSync(resNodePath)) {
                try {
                    resultJSON = JSON.parse(fs.readFileSync(resNodePath, 'utf8'));
                    fs.unlinkSync(resNodePath);
                } catch(e) {}
            }

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
            reject(new Error(`Gagal memanggil Worker: ${err.message}`));
        });
    });
}
module.exports = { executeBotAsync, jobStore };