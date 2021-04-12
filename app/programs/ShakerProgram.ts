import {Program, ProgramName} from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, {Bodies} from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class ShakerProgram implements Program {
    private lobbyController: LobbyController;
    private readyDisplays = 0;
    private readyControllers = 0;
    private gameLoop: any;
    private hit = false;
    private engine?: Matter.Engine;
    private numberOfTilesWidth = 5;
    private numberOfTilesHeight = 4;
    private tileSize = 128;
    private width = this.tileSize * this.numberOfTilesWidth;
    private height = this.tileSize * this.numberOfTilesHeight;
    private halfTileSize = this.tileSize / 2;
    private holeRadius = 50;
    private hammerPosX = this.halfTileSize;
    private hammerPosY = this.halfTileSize;
    private hammer?: Matter.Body;
    private hammerRadius = this.holeRadius;
    private gravityX: number = 0;
    private gravityY: number = 0;
    private moleRadius = this.holeRadius;
    private mole?: Matter.Body;
    private moleTimerId?: NodeJS.Timeout;
    private gameTimerId?: NodeJS.Timeout;
    private score: number = 0;
    private scoreInc : number = 50;
    private moveController?: SrcSocket;
    private hitController?: SrcSocket;
    private endedTutorial = 0;
    private countdownInterval: any;

    constructor(lobbyController: LobbyController){
        this.lobbyController = lobbyController;
        this.setControllerReadyListener();
        this.setDisplayReadyListener();
    }

    private setControllerReadyListener(): void {
        let controllers = this.lobbyController.getControllers();

        for(let controller of controllers){
            controller.addSocketOnce('controllerReady', this.controllerIsReady.bind(this));
        }
    }

    private setDisplayReadyListener(): void {
        let displays = this.lobbyController.getDisplays();

        for(let display of displays){
            display.addSocketOnce('displayReady', this.displayIsReady.bind(this));
        }
    }

    private displayIsReady(): void {
        this.readyDisplays++;
        if(this.readyControllers == 2 && this.readyDisplays == this.lobbyController.getDisplays().length){
            this.distributeResponsibilites();
        }
    }

    private controllerIsReady(): void {
        this.readyControllers++;
        if(this.readyControllers == 2 && this.readyDisplays == this.lobbyController.getDisplays().length){
            this.distributeResponsibilites();
        }
    }

    private distributeResponsibilites(): void {
        this.readyDisplays = 0;

        let controllers = this.lobbyController.getControllers();

        let v = Math.round(Math.random());
        
        this.moveController = controllers[v];
        this.hitController = controllers[(v + 1) % 2];

        this.moveController.emit('controllerResponsibility', true);
        this.hitController.emit('controllerResponsibility', false);

        for(let controller of controllers){
            controller.addSocketOnce('endedTutorial', this.controllerEndedTutorial.bind(this));
        }
    }

    private controllerEndedTutorial(): void {
        this.endedTutorial++;

        this.lobbyController.sendToDisplays('controllerEndedTutorial', this.endedTutorial);

        if(this.endedTutorial == 2) {
            this.setUpGame();
            this.lobbyController.sendToControllers('startSendingData', null);
        }
    }

    private setControllerDataListeners(): void {
        if(this.moveController && this.hitController){
            this.moveController.addSocketListener('controllerData', this.setGravity.bind(this));
            this.hitController.addSocketListener('controllerData', this.hammerHit.bind(this));
        }
    }

    private doCountdown(): void {
        if(this.moveController == null || this.hitController == null) return;

        this.moveController.removeSocketListener('controllerData');
        this.hitController.removeSocketListener('controllerData');

        this.gravityX = 0;
        this.gravityY = 0;

        let i = 3;

        this.lobbyController.sendToDisplays('countdown', i--);

        this.countdownInterval = setInterval(() => {
            this.lobbyController.sendToDisplays('countdown', i--);
            if(i == -1){
                clearInterval(this.countdownInterval);
                this.setControllerDataListeners();
                this.startGame();
            }
        }, 1000);
    }

    private setGravity(gravity: number[]): void {
        this.gravityX = gravity[0];
        this.gravityY = gravity[1];
    }

    private hammerHit(): void {
        this.hit = true;
        setTimeout(() => {this.hit = false;}, 300);
    }

    private setDisplayShakerBuildListener(): void {
        let displays = this.lobbyController.getDisplays();

        for(let display of displays){
            display.addSocketOnce('shakerBuild', this.shakerBuild.bind(this));
        }
    }

    private shakerBuild(): void {
        this.readyDisplays++;
        if(this.readyDisplays === this.lobbyController.getDisplays().length) {
            this.doCountdown();
        }
    }

    socketLeft(socketId: string): void {
        let displays = this.lobbyController.getDisplays();
        let controllers = this.lobbyController.getControllers();

        /* If the socket is a display, all listeners are removed
        so that socket.on() listeners aren't added twice once the socket may reconnect
        If no displays are left, the game gets ended */
        for (let i = 0; i < displays.length; i++) {
            if(displays[i].id === socketId){
                displays[i].removeAbsolutelyAllListeners();
                displays.splice(i, 1);

                if(displays.length == 0){
                    this.shutDownGame();
                }
                break;
            }
        }

        /* If the socket is a controller, all listeners are removed
        so that socket.on() listeners aren't added twice once the socket may reconnect 
        and the game ends */
        for (let i = 0; i < controllers.length; i++) {
            if(controllers[i].id === socketId){
                controllers[i].removeAbsolutelyAllListeners();
                controllers.splice(i, 1);

                this.shutDownGame();
                break;
            }
        }
    }

    private sendLevelInfoToDisplay(): void {
        if(this.mole == null) return;

        let data = [];
        data.push(this.numberOfTilesWidth);
        data.push(this.numberOfTilesHeight);
        // Hammer Start Position to left upper corner hole
        data.push(this.hammerPosX);
        data.push(this.hammerPosY);
        // Mole Start Position
        data.push(this.mole.position.x);
        data.push(this.mole.position.y);

        this.setDisplayShakerBuildListener();
        this.lobbyController.sendToDisplays('shakerData', data);
    }

    private creatWorldBounds(): void {
        if(this.engine == null) return;

        Matter.World.add(this.engine.world, [
            // Top
            Matter.Bodies.rectangle(this. width / 2, 0, this.width, 1, {
                isStatic: true
            }),
            // Left
            Matter.Bodies.rectangle(0, this.height / 2, 1, this.height, {
                isStatic: true
            }),
            // Bottom
            Matter.Bodies.rectangle(this.width / 2, this.height, this.width, 1, {
                isStatic: true
            }),
            // Right
            Matter.Bodies.rectangle(this.width, this.height / 2, 1, this.height, {
                isStatic: true
            })
        ])
    }

    private getRandomInt(max: number): number {
        return Math.floor(Math.random() * Math.floor(max));
    }

    private getRandomIntInterval(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private initMole(): void {
        if(this.engine == null) return;

        this.mole = Matter.Bodies.circle(
            this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
            this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize,
            this.moleRadius,
            {
                label: 'Mole',
                isSensor: true,
                isStatic: true
            }
        );
        Matter.World.add(this.engine.world, this.mole);
        this.moleTimerId = setInterval(() => this.resetMole(), this.getRandomIntInterval(3000, 5000));
    }

    private resetMole(): void {
        if(this.mole == null || this.moleTimerId == null) return;

        Matter.Body.setPosition(this.mole,
            {
                x: this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
                y: this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize
            });
        this.moleTimerId.refresh();
    }

    private initHammer(): void {
        if(this.engine == null) return;

        this.hammer = Matter.Bodies.circle(this.hammerPosX, this.hammerPosY, this.hammerRadius, {
            label: 'Hammer',
            mass: 100
        });
        Matter.World.add(this.engine.world, this.hammer);
    }

    private setUpGame() {
        this.engine = Matter.Engine.create();
        this.creatWorldBounds();
        this.initHammer();
        this.initMole();

        Matter.Events.on(this.engine,'collisionActive',(event) => {
            const pairs = event.pairs;

            let i = 0, j = pairs.length;
            for (; i != j; ++i) {
                const pair = pairs[i];

                if (pair.bodyA.label === 'Hammer' || pair.bodyB.label === 'Hammer') {
                    if (pair.bodyA.label === 'Mole') {
                        if (this.hit) {
                            this.resetMole();
                            this.score += this.scoreInc;
                        }
                    } else if (pair.bodyB.label === 'Mole') {
                        if (this.hit) {
                            this.resetMole();
                            this.score += this.scoreInc;
                        }
                    }
                }
            }
        });

        this.sendLevelInfoToDisplay();
    }

    private startGame(): void {
        this.gameTimerId = setTimeout(() => this.gameOver(), 60 * 1000);

        let fps = 60;

        this.gameLoop = setInterval(() => {
            if(this.engine == null || this.hammer == null || this.mole == null) return;

            this.engine.world.gravity.x = this.gravityX;
            this.engine.world.gravity.y = this.gravityY;
            Matter.Engine.update(this.engine, 1000 / fps);

            this.lobbyController.sendToDisplays('updateHammer', [this.hammer.position.x, this.hammer.position.y, this.mole.position.x, this.mole.position.y, this.hit, this.score]);
        }, 1000 / fps);
    }

    private cleanUp(): void {
        if(this.moleTimerId != null) clearInterval(this.moleTimerId);
        if(this.gameTimerId != null) clearTimeout(this.gameTimerId);
        clearInterval(this.gameLoop);
        clearInterval(this.countdownInterval);

        if(this.engine != null){
            Matter.World.clear(this.engine.world, false);
            Matter.Engine.clear(this.engine);
        }
    }

    private gameOver() {
        this.cleanUp();

        this.lobbyController.sendToDisplays('gameOver', true);

        this.lobbyController.getControllers()[0].emit('stopSendingData', true);
        this.lobbyController.getControllers()[1].emit('stopSendingData', false);

        this.lobbyController.getControllers()[0].addSocketOnce('goToMainMenu', this.goToMainMenu.bind(this));
    }

    private goToMainMenu() {
        this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
    }

    private shutDownGame(): void {
        this.cleanUp();
        if(this.engine != null){
            Matter.World.clear(this.engine.world, false);
            Matter.Engine.clear(this.engine);
        }
        
        this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
    }

    controllerJoin(socket: SrcSocket): boolean {
        socket.emit('gameRunning', null);
        return false;
    }

    displayJoin(socket: SrcSocket): boolean {
        socket.emit('gameRunning', null);
        return false;
    }
}
