/**
 * Signal: Server Connection Status
 * Used as the condition for the online editor layer
 */

const { Signal } = require("../../lib/EMAjs-master/loader");

// Server connection status signal
const serverConnected = new Signal(false);

console.log("Signal 'serverConnected' initialized (false)");

module.exports = serverConnected;
