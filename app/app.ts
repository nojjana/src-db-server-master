import * as socketIo from 'socket.io';
import { Socket } from "socket.io";
import { LobbyController } from './LobbyController';
import { SrcSocket } from './SrcSocket';

import http = require('http');
import express = require('express');

const https = require('https');
const fs = require('fs');


const app: express.Application = express();
let server;

if (fs.existsSync('/etc/letsencrypt/live/src-fhnw.xyz/privkey.pem')) {
    const privateKey = fs.readFileSync('/etc/letsencrypt/live/src-fhnw.xyz/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/src-fhnw.xyz/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/src-fhnw.xyz/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    server = https.createServer(credentials, app).listen(3005);
} else {
    server = http.createServer(app).listen(3005);
}

/* Setting up a mapping from lobby codes to LobbyControllers */
let lobbies: Map<number, LobbyController> = new Map();
let srcSockets: Map<string, SrcSocket> = new Map();

let socketIds: string[] = [];

/* Let socket.io listen on port 3005 */
let io = socketIo.listen(server);


io.on('connection', (socket: Socket) => {
    let srcSocket = new SrcSocket(socket);
    srcSockets.set(socket.id, srcSocket);

    /* Creates a new lobby with a unique lobby code
    and let's the initiating display join the lobby */
    socket.on('createLobby', () => {
        if(socketIds.includes(socket.id)){
            return;
        }

        socketIds.push(socket.id);

        let lobbyCode = createLobbyCode();
        let lobbyController = new LobbyController(lobbyCode, io);
        lobbies.set(lobbyCode, lobbyController);
        lobbyController.displayJoins(srcSocket);
    });

    /* Lets displays join a specific lobby targeted by a lobby code */
    socket.on('displayJoinsLobby', (lobbyCode: number) => {
        let lobbyController = lobbies.get(lobbyCode);

        if(socketIds.includes(socket.id)){
            return;
        }

        /* Check wether the lobby code is assigned to a lobby */
        if(lobbyController != null){
            let success = lobbyController.displayJoins(srcSocket);

            if(success){
                socketIds.push(socket.id);
            }
        } else {
            socket.emit('wrongLobbyCode');
        }
    });

    /* Lets controller join a specific lobby targeted by a lobby code */
    socket.on('controllerJoinsLobby', lobbyCode => {
        let lobbyController = lobbies.get(lobbyCode);

        if(socketIds.includes(socket.id)){
            return;
        }

        /* Check wether the lobby code is assigned to a lobby */
        if(lobbyController != null){
            let success = lobbyController.controllersJoins(srcSocket);

            if(success){
                socketIds.push(socket.id);
            }
        } else {
            socket.emit('wrongLobbyCode');
        }
    });

    /* Removes a socket form its lobby */
    socket.on('disconnect', () => {
        for(let lobby of Array.from(lobbies.values())){
            let srcSocket = srcSockets.get(socket.id);

            if(srcSocket != null && lobby.hasSocket(srcSocket)) {
                let deletable = lobby.socketLeft(socket.id);
                socketIds = socketIds.filter(id => id !== socket.id);

                /* If the last display left the lobby the lobby gets deleted */
                if(deletable){
                    let controllerSocketIds = lobby.getControllers().map(srcSocket => srcSocket.id);
                    socketIds = socketIds.filter(id => !controllerSocketIds.includes(id));

                    lobby.sendToControllers('gameEndedDueToNoDisplayAvailable', null);
                    lobbies.delete(lobby.getLobbyCode());
                }

                srcSockets.delete(socket.id);
                break;
            }
        }
    });
});

/* Recursivly creates a unique lobby code between 10'000 - 99'999 */
function createLobbyCode() : number {
    // long code
    // let tmp = Math.floor(Math.random() * (99999 - 10000) + 10000);

    // short code
    let tmp = Math.floor(Math.random() * (9 - 1) + 1);

    if(Array.from(lobbies.keys()).includes(tmp)) {
        return createLobbyCode();
    }

    return tmp;
}
