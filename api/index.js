// Vercel invokes the exported Express app; importing it never opens a port.
module.exports = require('../backend/index');
