exports.newNetworkModulesWebRTCNetworkClient = function newNetworkModulesWebRTCNetworkClient() {

    let thisObject = {
        socketNetworkClients: undefined,
        p2pNetworkNode: undefined,
        socketInterfaces: undefined,
        initialize: initialize,
        finalize: finalize
    }

    return thisObject

    function finalize() {
        thisObject.socketNetworkClients = undefined
        thisObject.p2pNetworkNode = undefined
        thisObject.socketInterfaces = undefined
        thisObject.peers = undefined
    }

    async function initialize(
        callerRole,
        p2pNetworkClientIdentity,
        p2pNetworkNode,
        maxOutgoingPeers
    ) {
        thisObject.socketInterfaces = NT.projects.network.modules.socketInterfaces.newNetworkModulesSocketInterfaces()
        thisObject.socketInterfaces.initialize()

        thisObject.signalingHost = NT.networkApp.p2pNetworkNode.node.networkInterfaces.webrtcNetworkInterface.config.signalServerHost
        thisObject.signalingPort = NT.networkApp.p2pNetworkNode.node.networkInterfaces.webrtcNetworkInterface.config.signalServerPort
        
        thisObject.p2pNetworkNode = p2pNetworkNode
        thisObject.p2pNetworkClientIdentity = p2pNetworkClientIdentity

        thisObject.peers = []
        
        var peerConnectionCfg =  {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}, {'urls': 'stun:global.stun.twilio.com:3478?transport=udp'}], sdpSemantics: 'unified-plan'}
        let peerConnection, datachannel

        //Signaling websocket setup
        const signalingChannel = new SA.nodeModules.ws(thisObject.signalingHost + ':' + thisObject.signalingPort)
        //const signalingChannel = new SA.nodeModules.ws('ws://localhost:9449')
        signalingChannel.channel = thisObject.p2pNetworkNode.networkCodeName || 'superalgos-default' //channel like peer chat rooms
          
        signalingChannel.onmessage = (msg) => {
            var signal = JSON.parse(msg.data)

            if(signal.isChannelPresent == false) {
                //new/empty channel. Create and wait for new peers
                signalingChannel.push(JSON.stringify({
                    open: true,
                    channel: signalingChannel.channel
                })) 
            } else if (signal.isChannelPresent == true) {
                //Channel available. Present yourself
                signalingChannel.push(JSON.stringify({
                    open: true,
                    channel: signalingChannel.channel
                }))
                setupOfferPeer() // create peer and make offer to others to connect
            }

            // We're getting an offer, so we answer to it
            if (signal.sdpOffer) {
                console.log('[Client] Got a SDP offer from remote peer')
                setupAnswerPeer(signal.sdpOffer) //configure remote peer and create an answer offer
            }
            else if (signal.sdpAnswer) {
                console.log('[Client] Got a SDP answer from remote peer')
                //Add remote peer configuration
                peerConnection.setRemoteDescription(new SA.nodeModules.wrtc.RTCSessionDescription(signal.sdpAnswer))
            }
            else if (signal.candidate) {
                console.log("[Client] Received ICECandidate from remote peer.")
                //Add remote peer configuration options to try to connect
                peerConnection.addIceCandidate(new SA.nodeModules.wrtc.RTCIceCandidate(signal.candidate))
            }
            else if (signal.closeConnection) {
                console.log("[Client] Received 'close' signal from remote peer.")
                peerConnection.close()
            }
        }
        
        // Open the signaling websocket connection and setup the messages with channel ID (network in SA)
        signalingChannel.onopen = () => {
            signalingChannel.push = signalingChannel.send
            signalingChannel.send = (data) => {
                signalingChannel.push(JSON.stringify({
                    data: data,
                    channel: signalingChannel.channel
                }))
            }
            //Check if channel is open/available
            signalingChannel.push(JSON.stringify({
                checkPresence: true,
                channel: signalingChannel.channel
            }))

        }

        // WebRTC Data Channel stuff     
        function setupOfferPeer() {
            //Create a new peer
            peerConnection = new SA.nodeModules.wrtc.RTCPeerConnection(peerConnectionCfg)
            peerConnection.nodeId = thisObject.p2pNetworkClientIdentity.node.id
            //Since we are initiating a connection, create the data channel
            datachannel = peerConnection.createDataChannel('myChannel')

            peerConnection.onicecandidate = (msg) => {
                // send any ice candidates to the other peer, i.e., msg.candidate
                console.log('[Offer] Sending ICE candidates')
                if (!msg || !msg.candidate) {return}
                signalingChannel.send({
                    candidate: msg.candidate
                })
            }
            //Here we create the configuration parameters to present to anyone who wants to connect to us
            console.log('[Offer] creating offer')
            peerConnection.createOffer((offer) => {
                peerConnection.setLocalDescription(new SA.nodeModules.wrtc.RTCSessionDescription(offer), () => {
                // send the offer to a server to be forwarded to the other peer
                signalingChannel.send({
                    sdpOffer: offer
                })
                }, (error) => { console.log(error) })
            }, (error) => { console.log(error) })
            //Setup the SA client for negotiation
            setUpClient(datachannel, callerRole, p2pNetworkClientIdentity, p2pNetworkNode)
        }

        function setupAnswerPeer(offer) {
            //Create a new peer
            peerConnection = new SA.nodeModules.wrtc.RTCPeerConnection(peerConnectionCfg)
            peerConnection.nodeId = thisObject.p2pNetworkClientIdentity.node.id

            peerConnection.onicecandidate = (msg) => {
                // send any ice candidates to the other peer, i.e., msg.candidate
                console.log('[Answer] Sending ICE candidates')
                if (!msg || !msg.candidate) {return}
                signalingChannel.send({
                    candidate: msg.candidate
                })
            }
            //Since we have received an offer from a peer, we configure the new peer with that config...
            peerConnection.setRemoteDescription(new SA.nodeModules.wrtc.RTCSessionDescription(offer))
            console.log('[Answer] creating answer')
            //.. And send our configuration to the offering peer
            peerConnection.createAnswer((answer) => {
                peerConnection.setLocalDescription(new SA.nodeModules.wrtc.RTCSessionDescription(answer), () => {
                // send the offer to a server to be forwarded to the other peer
                console.log('Sending Answer')
                signalingChannel.send({
                    sdpAnswer: answer
                })
                }, (error) => { console.log(error) })
            }, (error) => { console.log(error) })

            peerConnection.ondatachannel = evt => {
                datachannel = evt.channel
                
                datachannel.onopen = () => {
                    console.log('[Answer] The data connection is open. Start the magic')
                
                    let caller = {
                        socket: datachannel,
                        userProfile: undefined,
                        userAppBlockchainAccount: undefined,
                        role: undefined
                    }
    
                    caller.socket.id = SA.projects.foundations.utilities.miscellaneousFunctions.genereteUniqueId()
                    caller.socket.onclose = onConnectionClosed
    
                    let calledTimestamp = (new Date()).valueOf()
    
                    caller.socket.onmessage = onMessage
    
                    function onMessage(message) {
                        thisObject.socketInterfaces.onMenssage(message, caller, calledTimestamp)
                    }
    
                    function onConnectionClosed() {
                        let socketId = this.id
                        thisObject.socketInterfaces.onConnectionClosed(socketId)
                    }
                }
            }
        }
    }

    async function setUpClient(socket, callerRole, p2pNetworkClientIdentity, p2pNetworkNode) {

        return new Promise(connectToNetwork)

        function connectToNetwork(resolve, reject) {

            thisObject.socketNetworkClients = SA.projects.network.modules.socketNetworkClients.newNetworkModulesSocketNetworkClients()
            thisObject.socketNetworkClients.initialize(
                socket,
                callerRole,
                p2pNetworkClientIdentity,
                p2pNetworkNode,
                //p2pNetworkClient
            )

            try {

                socket.onopen = () => { onConnectionOpened() }
                socket.onclose = () => { onConnectionClosed() }
                socket.onerror = err => { onError(err) }

                function onConnectionOpened() {

                    thisObject.socketNetworkClients.handshakeProcedure(resolve, reject)

                }

                function onConnectionClosed() {
                    if (thisObject.isConnected === true) {
                        console.log('Websockets Client Disconnected from Network Node via Web Sockets ............. Disconnected from ' + thisObject.p2pNetworkNode.userProfile.config.codeName + ' -> ' + thisObject.p2pNetworkNode.node.name + ' -> ' + thisObject.host + ':' + thisObject.port)
                    }
                    if (thisObject.onConnectionClosedCallBack !== undefined) {
                        thisObject.onConnectionClosedCallBack(thisObject.id)
                    }
                    thisObject.isConnected = false
                }

                function onError(err) {
                    if (err.message.indexOf('ECONNREFUSED') >= 0) {
                        console.log('[WARN] Web Sockets Network Client -> onError -> Nobody home at ' + thisObject.host + ':' + thisObject.port)
                        reject()
                        return
                    }
                    console.log('[ERROR] Web Sockets Network Client -> onError -> err.message = ' + err.message)
                    console.log('[ERROR] Web Sockets Network Client -> onError -> err.stack = ' + err.stack)
                    reject()
                    return
                }

            } catch (err) {
                console.log('[ERROR] Web Sockets Network Client -> setUpWebSocketClient -> err.stack = ' + err.stack)
            }
        }
    }
}