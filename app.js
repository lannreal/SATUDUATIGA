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