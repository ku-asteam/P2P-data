# Web-P2P-Data
A JavaScript library for data communication between browsers

## Introduction
Web-P2P-Data is a javascript library for enabling peer to peer communication of web browsers or pages. This library helps to establish a WebRTC connection with another browser or web page. For establishing the WebRTC connecting, this library tries to communicate with signal server through socket.io. After the WebRTC connection is established, a data channel is created to perform direct communication between browsers or between web pages.

## Requirements
* socket.io

## Instructions

### init
```
p2p_data.init(room_id);
```
Start establishing peer to peer connection. Peers with the same room_id are connected.

### sendDataToPeers
```
p2p_data.sendDataToPeers({
  message: "hello, world!"
});
```
Send data to another peer. JSON is recommended as the data type.

### addDataHandler
```
var my_handler = function (message) {
    // message is event.data!
    
    console.log(message);
}
p2p_data.addDataHandler(my_handler);
```
In order to check and process data from other peers, some data handlers must be registered through this function.

### removeDataHandler
```
p2p_data.removeDataHandler(my_handler);
```
A data handler can be removed.

### checkIsConnected
```
p2p_data.checkIsConnected(); // true or false
```
See if this browser or web page is connected to other peer. The return value is boolean - true or false.
