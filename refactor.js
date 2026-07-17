const fs = require('fs');
const path = require('path');

const original = fs.readFileSync('app.js', 'utf8');
const lines = original.split('\n');

// 1. Create src directory
fs.mkdirSync('src', { recursive: true });

// 2. Extract bot.js
let botLines = lines.slice(6, 797); // Lines 7 to 797
let botCode = "(async () => {\n" + botLines.join('\n') + "\n})();";
// Fix paths for config and res_node to point to parent dir
botCode = botCode.replace(/path\.join\(__dirname,\s*'config_prem\.json'\)/g, "path.join(__dirname, '..', 'config_prem.json')");
botCode = botCode.replace(/path\.join\(__dirname,\s*'res_node\.json'\)/g, "path.join(__dirname, '..', 'res_node.json')");
fs.writeFileSync('src/bot.js', botCode);

// 3. Extract utils.js
const utilsCode = `
const C = {
    reset: "\\x1b[0m", bold: "\\x1b[1m", cyan: "\\x1b[36m", brightCyan: "\\x1b[96m",
    green: "\\x1b[32m", brightGreen: "\\x1b[92m", yellow: "\\x1b[33m", brightYellow: "\\x1b[93m",
    magenta: "\\x1b[95m", brightMagenta: "\\x1b[95m", red: "\\x1b[91m", gray: "\\x1b[90m", white: "\\x1b[97m"
};
module.exports = { C };
`;
fs.writeFileSync('src/utils.js', utilsCode.trim());

// 4. Extract config.js
const configCode = `
const fs = require('fs');
const path = require('path');
const { C } = require('./utils');
const CONFIG_PATH = path.join(__dirname, '..', 'config_prem.json');

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
        console.log(\`\${C.brightGreen}[✔] Config berhasil diperbarui: config_prem.json\${C.reset}\`);
        return true;
    } catch (e) {
        console.error(\`\${C.red}[!] Gagal menyimpan config_prem.json:\${C.reset}\`, e.message);
        return false;
    }
}
module.exports = { getConfig, saveConfig };
`;
fs.writeFileSync('src/config.js', configCode.trim());

// 5. Extract executor.js
const executorCode = `
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

        if (!silentMode) console.log(\`\${C.cyan}[*] Executing Bot Worker: action=\${action}, args=[\${args.join(', ')}]\${C.reset}\`);
        
        const botPath = path.join(__dirname, 'bot.js');
        const botProcess = spawn('node', [botPath, action, ...args], {
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
                const lines = stdoutData.trim().split('\\n');
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
                return reject(new Error(\`Proses Worker berakhir dengan kode error \${code}. Stderr: \${stderrData.trim() || 'Tidak ada info error'}\`));
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
            reject(new Error(\`Gagal memanggil Worker: \${err.message}\`));
        });
    });
}
module.exports = { executeBotAsync, jobStore };
`;
fs.writeFileSync('src/executor.js', executorCode.trim());

// 6. Extract server.js (Lines 962-1215)
let serverLines = lines.slice(961, 1215);
let serverCode = `
const http = require('http');
const { getConfig, saveConfig } = require('./config');
const { executeBotAsync, jobStore } = require('./executor');
const { C } = require('./utils');
const PORT = process.env.PORT || 3000;
let currentCronIntervalMinutes = 25;

${serverLines.join('\n')}

module.exports = { startAPIServer };
`;
fs.writeFileSync('src/server.js', serverCode.trim());

// 7. Extract cli.js (Lines 1222-1368)
let cliLines = lines.slice(1221, 1368);
let cliCode = `
const readline = require('readline');
const { startAPIServer } = require('./server');
const { executeBotAsync } = require('./executor');
const { C } = require('./utils');
const PORT = process.env.PORT || 3000;

${cliLines.join('\n')}

module.exports = { startCLIMode };
`;
fs.writeFileSync('src/cli.js', cliCode.trim());

// 8. Generate new app.js
const newAppJsCode = `
/**
 * ⚡ AM GENERATOR PREMIUM - UNIFIED SERVER & CLI AUTOMATION ENGINE (v2.0.0) ⚡
 */
const { startAPIServer } = require('./src/server');
const { startCLIMode } = require('./src/cli');

if (process.argv.includes('--api') || process.argv.includes('--server') || process.argv.includes('-s') || process.env.RAILWAY_ENVIRONMENT) {
    startAPIServer();
} else {
    startCLIMode();
}
`;
fs.writeFileSync('app.js.new', newAppJsCode.trim());

console.log("Refactoring script completed successfully.");
