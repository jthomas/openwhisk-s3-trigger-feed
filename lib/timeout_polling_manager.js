const PollManager = require('./poll_manager.js')

module.exports = () => PollManager(new Map(), setTimeout, clearTimeout)
