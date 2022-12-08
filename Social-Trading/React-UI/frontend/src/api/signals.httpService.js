import {httpRequest, POST} from './httpConfig'


function listenSignals(userProfileId, eventType) {
    return httpRequest('/signals', GET, {userProfileId: userProfileId, eventType: eventType})
}

export {
    listenSignals
}