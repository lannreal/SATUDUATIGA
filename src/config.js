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
        console.log(`${C.brightGreen}[✔] Config berhasil diperbarui: config_prem.json${C.reset}`);
        return true;
    } catch (e) {
        console.error(`${C.red}[!] Gagal menyimpan config_prem.json:${C.reset}`, e.message);
        return false;
    }
}
module.exports = { getConfig, saveConfig };