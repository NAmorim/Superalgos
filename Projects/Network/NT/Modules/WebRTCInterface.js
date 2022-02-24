exports.newNetworkModulesWebRTCInterface = function newNetworkModulesWebRTCInterface() {
    /*
    This module represents the websockets interface of the Network Node.

    A Network Nodes is expected to receive requests from 2 different types
    of entities:

    1. Other Network Nodes.
    2. Client Apps. 

    This module deals with those 2 connection types and is the one receiving from
    and sending messages to those entities.
    */
    let thisObject = {
        socketInterfaces: undefined, 
        socketServer: undefined,
        initialize: initialize,
        finalize: finalize
    }

    return thisObject

    function finalize() {
        thisObject.socketServer = undefined
        thisObject.socketInterfaces.finalize()
        thisObject.socketInterfaces = undefined
    }

    function initialize() {
        thisObject.socketInterfaces = NT.projects.network.modules.socketInterfaces.newNetworkModulesSocketInterfaces()
        thisObject.socketInterfaces.initialize()

        thisObject.signalingPort = NT.networkApp.p2pNetworkNode.node.networkInterfaces.webrtcNetworkInterface.config.signalServerPort
        thisObject.socketServer = SA.nodeModules.ws.Server

        setUpSignalingServer()
    }

    function setUpSignalingServer() {
        //var fs = SA.nodeModules.fs
        var http = SA.nodeModules.http
        //var WebSocketServer = SA.nodeModules.ws.Server
        var CHANNELS = {}

        try {
            // don't forget to use your own keys if you want SSL!
            /* var options = {
                key: fs.readFileSync('My-Secrets/rtclocal.key'),
                cert: fs.readFileSync('My-Secrets/rtclocal.pem')
            }; */

            // HTTPs server
            var app = http.createServer(function(request, response) {
                response.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                var link = 'https://superalgos.org'
                response.write('<title>Superalgos Signaling</title><h1><a href="'+ link + '">Superalgos</a></h1><pre>var websocket = new WebSocket("wss://signal.superalgos.org:9449/");</pre>')
                response.end()
            })

            function onRequest(socket) {
                var origin = socket.origin + socket.resource
            
                var websocket = socket.accept(null, origin)
            
                websocket.on('message', function(message) {
                    if(!message || !websocket) return;
            
                    if (message.type === 'utf8') {
                        try {
                            onMessage(JSON.parse(message.utf8Data), websocket);
                        }
                        catch(e) {}
                    }
                })
            
                websocket.on('close', function() {
                    try {
                        truncateChannels(websocket);
                    }
                    catch(e) {}
                });
            }
            
            function onMessage(message, websocket) {
                if(!message || !websocket) return
            
                try {
                    console.log('Received message: ', message)
                    if (message.checkPresence) {
                        checkPresence(message, websocket)
                    }
                    else if (message.open) {
                        onOpen(message, websocket)
                    }
                    else {
                        sendMessage(message, websocket)
                    }
                }
                catch(e) {}
            }
            
            function onOpen(message, websocket) {
                if(!message || !message.channel || !websocket) return;
            
                try {
                    var channel = CHANNELS[message.channel]
                    //console.log('Added new channel: ', channel)
            
                    if (channel) {
                        CHANNELS[message.channel][channel.length] = websocket
                    }
                    else {
                        CHANNELS[message.channel] = [websocket]
                    }
                }
                catch(e) {}
            }
            
            function sendMessage(message, websocket) {
                if(!message || !message.data || !websocket) return;
                var channel = [];
            
                try {
                    message.data = JSON.stringify(message.data)
                    channel = CHANNELS[message.channel]
                }
                catch(e) {}
            
                if (!channel || !message || !message.data) {
                    console.log('channel is missing')
                    return
                }
            
                for (var i = 0; i < channel.length; i++) {
                    if (channel[i] && channel[i] != websocket) {
                        try {
                            channel[i].sendUTF(message.data)
                        } catch(e) {}
                    }
                }
            }
            
            function checkPresence(message, websocket) {
                if(!message || !message.channel || !websocket) return
            
                try {
                    websocket.sendUTF(JSON.stringify({
                        isChannelPresent: !!CHANNELS[message.channel]
                    }))
                }
                catch(e) {}
            }
            
            function swapArray(arr) {
                var swapped = [],
                    length = arr.length || 0;
            
                for (var i = 0; i < length; i++) {
                    if (arr[i]) {
                        try {
                            swapped[swapped.length] = arr[i]
                        }
                        catch(e) {}
                    }
                }
                return swapped;
            }
            
            function truncateChannels(websocket) {
                if(!websocket) return;
            
                for (var channel in CHANNELS) {
                    var _channel = CHANNELS[channel];
                    if(_channel && _channel.length) {
                        for (var i = 0; i < _channel.length; i++) {
                            try {
                                if (_channel[i] == websocket) {
                                    delete _channel[i];
                                }
                            }
                            catch(e) {}
                        }
            
                        try {
                            CHANNELS[channel] = swapArray(_channel);
            
                            if (CHANNELS && CHANNELS[channel] && !CHANNELS[channel].length) {
                                delete CHANNELS[channel];
                            }
                        }
                        catch(e) {}
                    }
                }
            }
            
            new thisObject.socketServer({
                server: app,
                autoAcceptConnections: false
            }).on('request', onRequest)
            
            app.listen(thisObject.signalingPort || 9456)

            //thisObject.socketServer = new SA.nodeModules.ws.WebSocketServer({ server: app })
            //thisObject.socketServer.on('request', onRequest)
            
            //app.listen(thisObject.signalingPort || 9456)
            //thisObject.socketServer.listen(thisObject.signalingPort || 9456)
            process.on('unhandledRejection', (reason, promise) => {
              process.exit(1)
            });
            
            //console.log('Please open SSL URL: https://localhost:'+(thisObject.signalingPort || 9456)+'/')
        } catch (err) {
            console.log('[ERROR] WebSockets Signaling Interface -> setUpSignalingServer -> err.stack = ' + err.stack)
        }
    }
}