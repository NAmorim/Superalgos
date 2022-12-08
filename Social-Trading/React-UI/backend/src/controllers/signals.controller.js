const {signalsService} = require('../services');

const listenSignals = async (req, res) => {
    const result = await signalsService.listenSignals();
    res.send(result);

};


module.exports = {
    listenSignals
};