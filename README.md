# Game server of the Shared Remote Controller (SRC) Platform

This project is one of three projects of the shared remote controller platform. 
It is responsible for the lobby management, broadcasting update events to the browser front end, receiving sensor values from the mobile front end and computing the games.
It is written in TypeScript and runs on a Node Server. It communicates with websockets with the other project. We used [Socket.io](https://socket.io/) for the websockets.
The image below shows, how the projects works together. The browser front end is displaying the platform and rendering the games. The game server sends update events to the browser front end. The game server receives sensor data from the mobile front end. It computes the games with this data. Furthermore the game server handles the websocket connections and is responsible for the lobby management.

![Image of the SRC Platform](https://github.com/andreasumbricht/src-browser/blob/master/src/assets/Plattform%20Aufbau.PNG)

## Installation
### Environment
First, you must install node and npm. The exact steps to install node and npm are platform dependent.

The project was written with the following versions:
| Name          | Version        |
| ------------- |:-------------:|
| Node     | 10.14.2 |
| npm     | 6.4.1      |

### Source code
You can get the source code of this repository with the command:

```bash
git clone https://github.com/andreasumbricht/src-ionic.git
```

After that, install all packages assocciated with the project with the command:
```bash
npm install
```

### Verification
If you type `npm run dev` in the terminal, inside your cloned repository, you should not see any error messges.

## Development
You can start the development server with the command:
```bash
npm run dev
```
This will start a live-reload development server on your localhost.

## Deployment (Linux)

1. Be sure, that node and npm is up and running on your webserver.

2. Install the forever npm package on your webserver.

3. Upload all needed files to your webserver in the home directory.

4. Run the following commands:
```bash
sudo -i
rm /home/ubuntu/src-db-server/logs/output.log
forever start -l /home/ubuntu/src-db-server/logs/output.log -o /home/ubuntu/src-db-server/logs/outfile.log -e /home/ubuntu/src-db-server/logs/err.log build/app.js
```

5. If you don't work on the same server, as this project was initially created (https://src-fhnw.xyz), you need to change the url's in app.js on line 16-19 according to your https certificates. If you don't do this, a regular http server will be deployed instead.
