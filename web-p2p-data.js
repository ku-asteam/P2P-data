/**
 * web-p2p-data.js for WebCross
 * 
 * Park, Seonghoon (park.s@yonsei.ac.kr)
 * Lee, Jeho (jeholee@yonsei.ac.kr)
 * 
 * Requirements: socket.io
 */

"use strict";

let web_p2p_data = (function(){
  /**
   * Private members
   */
  let room = "";
  let url = "";
  let socket = null;
  let isChannelReady = false;
  let isInitiator = false;
  let isStarted = false;
  let turnReady; // TODO

  let isPeerConnected = false;
  let peerConnection = null;
  let dataChannel = null;

  let dataHandler = null;

  let pcConfig = {
    'iceServers': [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'stun:stun1.l.google.com:19302'
      },
      {
        urls: 'stun:stun2.l.google.com:19302'
      },
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
      }
    ]
  };

  let userEventHandlers = {
    open: [],
    close: [],
    error: []
  };

  /****************************************************************************
  * WebRTC peer connection and data channel
  ****************************************************************************/
  function maybeStart() {
    console.log('>>>>>>> maybeStart() ', isStarted, isChannelReady);
    if (!isStarted && isChannelReady) {
      console.log('>>>>>> creating peer connection');
      createPeerConnection();
      isStarted = true;
      console.log('isInitiator', isInitiator);
      if (isInitiator) {
        doCall();
      }
    }
  }

  window.onbeforeunload = function() {
    sendMessage('bye');
  };

  /////////////////////////////////////////////////////////
  /**
   * @function createPeerConnection
   * 
   */
  function createPeerConnection() {
    try {
      peerConnection = new RTCPeerConnection(pcConfig);
      peerConnection.onicecandidate = handleIceCandidate;
      console.log('Created RTCPeerConnnection');
    } catch (e) {
      console.log('Failed to create PeerConnection, exception: ' + e.message);
      alert('Cannot create RTCPeerConnection object.');
      return;
    }
  }

  function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  }



  /////////////////////////////////////////////////////////
  function doCall() {
    createDataChannel();
    console.log('Sending offer to peer');
    peerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  }

  /////////////////////////////////////////////////////////
  function createDataChannel() {
    console.log('Creating data channel');
    dataChannel = peerConnection.createDataChannel('WebCross');
    onDataChannelCreated(dataChannel);
  }

  function onDataChannelCreated(channel) {
    console.log('onDataChannelCreated:', channel);
    dataChannel.onopen = onDataChannelOpen;
    dataChannel.onclose = onDataChannelClose;
    dataChannel.onmessage = onDataChannelMessage;
    dataChannel.onerror = onDataChannelError;
  }

  function onDataChannelOpen() {
    isPeerConnected = true;

    console.log('CHANNEL opened!!!', isPeerConnected);
    for(var fn of userEventHandlers["open"]) {
      fn.function(fn.params);
    }
  }

  function onDataChannelClose() {
    isPeerConnected = false;

    console.log('Channel closed.', isPeerConnected);
    for(var fn of userEventHandlers["close"]) {
      fn.function(fn.params);
    }
  }

  function onDataChannelMessage(event) {
    // event.data is sendDataToPeers' message!!
    dataHandler.fire(event.data);
  }

  function onDataChannelError(event) {
    console.log(event);

    for(var fn of userEventHandlers["error"]) {
      fn.function(event, fn.params);
    }
  }


  /////////////////////////////////////////////////////////
  function DataHandler() {
    this.handlers = []; // observer
  }

  DataHandler.prototype = {
    subscribe: function(fn) {
      this.handlers.push(fn);
    },

    unsubscribe: function(fn) {
      this.handlers = this.handlers.filter(
        function(item) {
          if(item !== fn) {
            return item;
          }
        }
      );
    },

    fire: function(o, thisObj) {
      var scope = thisObj || window;
      this.handlers.forEach(function(item) {
        item.call(scope, o);
      });
    }
  }


  /////////////////////////////////////////////////////////
  function doAnswer() {
    console.log('Sending answer to peer.');
    peerConnection.ondatachannel = function (event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      onDataChannelCreated(dataChannel);
    };

    peerConnection.createAnswer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
    );
  }

  function setLocalAndSendMessage(sessionDescription) {
    peerConnection.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
  }

  function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
  }

  function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
  }



  /////////////////////////////////////////////////////////
  function hangUp() {
    console.log('Hanging up.');
    sendMessage('bye');
    stop();
  }

  function handleRemoteHangUp() {
    console.log('Session terminated.');
    stop();
  }

  function stop() {
    isInitiator = false;

    isChannelReady = false;
    isStarted = false;
    isPeerConnected = false;

    dataChannel.close();
    dataChannel = null;

    peerConnection.close();
    peerConnection = null;
  }

  /////////////////////////////////////////////////////////
  function sendDataToPeers(message) {
    if (!dataChannel) {
      console.log("sendDataToPeers error!!");
      return;
    }

    dataChannel.send(message);
  }

  /**
   * 
   * Public members
   * 
   */
  return {
    init: function(_room, _url) {
      room = _room;
      url = _url;
      socket = io.connect(url);
      
      /****************************************************************************
      * Signaling server
      ****************************************************************************/
      socket.on('created', function(room) {
        console.log('Created room ' + room);
        isInitiator = true;
      });

      socket.on('ready', function (room) {
        isChannelReady = true;

        sendMessage("connect WebRTC");
        if (isInitiator) { // redundant? TODO
          maybeStart();
        }
      });

      socket.on('joined', function(room) {
        console.log('joined: ' + room);
        isChannelReady = true;
      });

      socket.on('full', function(room) {
        console.log('Room ' + room + ' is full');
      });

      socket.on('log', function(array) {
        console.log.apply(console, array);
      });

      ////////////////////////////////////////////////

      function sendMessage(message) {
        console.log('Client sending message: ', message);
        socket.emit('message', message);
      }

      socket.on('message', function(message) {
        console.log('Client received message:', message);
        if (message === 'connect WebRTC') {
          maybeStart();
        } else if (message.type === 'offer') {
          console.log("Offer!");
          if (!isInitiator && !isStarted) {
            maybeStart();
          }
          peerConnection.setRemoteDescription(new RTCSessionDescription(message));
          doAnswer();
        } else if (message.type === 'answer' && isStarted) {
          console.log("Answer!");
          peerConnection.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate' && isStarted) {
          let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
          });
          peerConnection.addIceCandidate(candidate);
        } else if (message === 'bye' && isStarted) {
          handleRemoteHangUp();
        }
      });
      
      if (room !== '') {
        socket.emit('create or join', room);
        console.log('Attempted to create or join room', room);
      }
    
      if (location.hostname !== 'localhost') {
        // TODO check
        requestTurn(
          "stun:stun.l.google.com:19302"
        );
      }

      dataHandler = new DataHandler();

      // temporary
      function tmplog(msg) {
        console.log(msg);
      }
      dataHandler.subscribe(tmplog);
    },

    hangUp: function() {
      hangUp();
    },

    checkIsConnected: function() {
      return isPeerConnected;
    },

    sendDataToPeers: function(message) {
      // message must be JSON format
      var data = JSON.stringify(message);
      return sendDataToPeers(data);
    },

    addDataHandler: function(handler) {
      dataHandler.subscribe(handler);
    },

    removeDataHandler: function(handler) {
      dataHandler.unsubscribe(handler);
    },

    addUserEventHandler: function(event, function_name, params) {
      userEventHandlers[event].push({
        function: function_name,
        params: params
      });
    }

  }
})();
