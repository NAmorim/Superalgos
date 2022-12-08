const registerSignals = async (req, res) => {
    try {
        let queryMessage = {
            queryType: SA.projects.socialTrading.globals.queryTypes.EVENTS,
            originSocialPersonaId: req.originSocialPersonaId,
            initialIndex: SA.projects.socialTrading.globals.queryConstants.INITIAL_INDEX_LAST,
            amountRequested: 20,
            direction: SA.projects.socialTrading.globals.queryConstants.DIRECTION_PAST
        }

        let query = {
            networkService: 'Social Graph',
            requestType: 'Signal',
            queryMessage: JSON.stringify(queryMessage)
        }

        return await webAppInterface.sendMessage(
            JSON.stringify(query)
        )

    } catch (error) {
        console.log(error);
    }
};

const listenSignals = () => {
    return ST.socialTradingApp.p2pNetworkInterface.eventReceived
}

module.exports = {
    listenSignals,
    registerSignals
};
