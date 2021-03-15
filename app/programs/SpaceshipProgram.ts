import {Program, ProgramName} from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class SpaceshipProgram implements Program {
    private lobbyController: LobbyController;
    private readyDisplays = 0;
    private readyControllers = 0;
    private gameLoop: any;
    private engine?: Matter.Engine;
    private width: number = 1920;
    private height: number = 1080;
    private spaceShipXPosition = this.width / 2;
    private spaceShipYPosition = 800;
    private spaceShipSize = 60;
    private spaceShip?: Matter.Body;
    private asteroidSize = 50;
    private nrOfAsteroids = 4;
    private asteroidSlice = this.width / this.nrOfAsteroids;
    private asteroid1?: Matter.Body;
    private asteroid2?: Matter.Body;
    private asteroid3?: Matter.Body;
    private asteroid4?: Matter.Body;
    private minSpeed: number = 0.5;
    private maxSpeed: number = 1.5;
    private score: number = 0;
    private scoreInc: number = 1;
    private asteroidReset: boolean = false;
    private nrOfLives: number = 3;
    private leftController?: SrcSocket;
    private rightController?: SrcSocket;
    private endedTutorial = 0;
    private leftForce = 0;
    private rightForce = 0;
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
        this.leftController = controllers[v];
        this.rightController = controllers[(v + 1) % 2];

        this.leftController.emit('controllerResponsibility', true);
        this.rightController.emit('controllerResponsibility', false);

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
            this.doCountdown();
        }
    }

    private doCountdown(): void {
        if(this.leftController == null || this.rightController == null || this.engine == null) return;

        this.leftController.removeSocketListener('controllerData');
        this.rightController.removeSocketListener('controllerData');

        this.leftForce = 0;
        this.rightForce = 0;
        this.engine.world.gravity.x = 0;
        this.engine.world.gravity.y = 0;

        let i = 3;

        this.lobbyController.sendToDisplays('countdown', i--);

        this.countdownInterval = setInterval(() => {
            this.lobbyController.sendToDisplays('countdown', i--);
            if(i == -1 && this.engine != null){
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.setControllerDataListeners();
                this.engine.world.gravity.x = 0;
                this.engine.world.gravity.y = 0.5;
            }
        }, 1000);
    }

    private setControllerDataListeners(): void {
        if(this.leftController && this.rightController){
            this.leftController.addSocketListener('controllerData', this.setLeftForce.bind(this));
            this.rightController.addSocketListener('controllerData', this.setRightForce.bind(this));
        }
    }

    private setLeftForce(leftForce: number): void {
        this.leftForce = leftForce;
    }

    private setRightForce(rightForce: number): void {
        this.rightForce = rightForce;
    }

    private setDisplaySpaceShipBuildListener(): void {
        let displays = this.lobbyController.getDisplays();

        for(let display of displays){
            display.addSocketOnce('spaceShipBuild', this.labyrinthBuildCallback.bind(this));
        }
    }

    private labyrinthBuildCallback(): void {
        this.readyDisplays++;
        if(this.readyDisplays === this.lobbyController.getDisplays().length) {
            this.startGame();
        }
    }

    private startGame(): void {
        let fps = 60;

        this.gameLoop = setInterval( () => {
            if(this.engine == null || this.asteroid1 == null || this.asteroid2 == null 
                || this.asteroid3 == null || this.asteroid4 == null || this.spaceShip == null) return;

            Matter.Engine.update(this.engine, 1000/fps);

            if(this.countdownInterval == null){
                this.score = this.score + this.scoreInc / 60;
            }

            let diff = this.rightForce - this.leftForce;

            diff *= 0.015;

            if(diff > 1){
                diff = 1;
            } else if(diff < -1){
                diff = -1;
            }

            Matter.Body.setPosition(this.spaceShip,
                {
                    x: this.spaceShip.position.x,
                    y: this.spaceShipYPosition
            });

            Matter.Body.setVelocity(this.spaceShip, {
                x: this.spaceShip.velocity.x += diff,
                y: 0
            });

            this.respawnAsteroids();

            this.lobbyController.sendToDisplays('updateSpaceShip',[
                this.spaceShip.position.x, this.spaceShip.position.y,
                this.asteroid1.position.x, this.asteroid1.position.y,
                this.asteroid2.position.x, this.asteroid2.position.y,
                this.asteroid3.position.x, this.asteroid3.position.y,
                this.asteroid4.position.x, this.asteroid4.position.y,
                Math.floor(this.score), this.nrOfLives
            ]);
        }, 1000 / fps);
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

                this.lobbyController.sendToDisplays('wentToMainMenuDueToControllerLeft', null);
                
                this.shutDownGame();
                break;
            }
        }
    }

    private shutDownGame(): void {
        clearInterval(this.gameLoop);
        clearInterval(this.countdownInterval);
        if(this.engine != null){
            Matter.World.clear(this.engine.world, false);
            Matter.Engine.clear(this.engine);
        }
        
        this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
    }

    private gameOver() {
        clearInterval(this.gameLoop);
        clearInterval(this.countdownInterval);
        if(this.engine != null) Matter.World.clear(this.engine.world, false);
        if(this.engine != null) Matter.Engine.clear(this.engine);

        this.lobbyController.sendToDisplays('gameOver', this.nrOfLives !== 0);

        this.lobbyController.getControllers()[0].emit('stopSendingData', true);
        this.lobbyController.getControllers()[1].emit('stopSendingData', false);

        this.lobbyController.getControllers()[0].addSocketOnce('goToMainMenu', this.goToMainMenu.bind(this));
    }

    private goToMainMenu() {
        this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
    }

    private setUpGame(): void {
        this.engine = Matter.Engine.create();

        this.createWorldBoundsForSpaceShip();

        this.initSpaceShip();

        this.spawnAsteroids();

        this.sendLevelInfoToDisplay();

        Matter.Events.on(this.engine,'collisionStart',(event) => {
            const pairs = event.pairs;

            let i = 0, j = pairs.length;
            for (; i != j; ++i) {
                const pair = pairs[i];

                if (pair.bodyA.label === 'Asteroid' || pair.bodyB.label === 'Asteroid') {
                    if (pair.bodyA.label === 'SpaceShip' || pair.bodyB.label === 'SpaceShip') {
                        this.spaceshipHit();
                    }
                }
            }
        });
    }

    private spaceshipHit(): void {
        if(this.engine == null || this.asteroid1 == null || this.asteroid2 == null 
            || this.asteroid3 == null || this.asteroid4 == null || this.spaceShip == null) return;

        if(this.nrOfLives > 0){
            this.nrOfLives--;
            
            if(this.nrOfLives == 0){
                this.gameOver();
            } else {
                this.doCountdown();
                Matter.World.remove(this.engine.world, this.spaceShip);
                Matter.World.remove(this.engine.world, this.asteroid1);
                Matter.World.remove(this.engine.world, this.asteroid2);
                Matter.World.remove(this.engine.world, this.asteroid3);
                Matter.World.remove(this.engine.world, this.asteroid4);
        
                this.initSpaceShip();
                this.spawnAsteroids();
            }
        }
    }

    private sendLevelInfoToDisplay(): void {
        if(this.asteroid1 == null || this.asteroid2 == null 
            || this.asteroid3 == null || this.asteroid4 == null || this.spaceShip == null) return;
        let data = [];
        data.push(this.spaceShip.position.x);
        data.push(this.spaceShip.position.y);
        data.push(this.asteroid1.position.x);
        data.push(this.asteroid1.position.y);
        data.push(this.asteroid2.position.x);
        data.push(this.asteroid2.position.y);
        data.push(this.asteroid3.position.x);
        data.push(this.asteroid3.position.y);
        data.push(this.asteroid4.position.x);
        data.push(this.asteroid4.position.y);

        this.setDisplaySpaceShipBuildListener();

        this.lobbyController.sendToDisplays('spaceShipData', data);
    }

    private initSpaceShip(): void {
        if(this.engine == null) return;

        this.spaceShip = Matter.Bodies.circle( this.spaceShipXPosition, this.spaceShipYPosition, this.spaceShipSize,
            {
                label: 'SpaceShip',
                mass: 100,
                restitution: 0.5
            });
        Matter.World.add(this.engine.world, this.spaceShip);
    }

    private spawnAsteroids(): void {
        if(this.engine == null) return;
        
        this.asteroid1 = this.initAsteroid(0, this.asteroidSlice, this.minSpeed, this.maxSpeed);
        this.asteroid2 = this.initAsteroid(this.asteroidSlice, 2 * this.asteroidSlice, this.minSpeed, this.maxSpeed);
        this.asteroid3 = this.initAsteroid(2 * this.asteroidSlice, 3 * this.asteroidSlice, this.minSpeed, this.maxSpeed);
        this.asteroid4 = this.initAsteroid(3 * this.asteroidSlice, 4 * this.asteroidSlice, this.minSpeed, this.maxSpeed);
        Matter.World.add(this.engine.world, this.asteroid1);
        Matter.World.add(this.engine.world, this.asteroid2);
        Matter.World.add(this.engine.world, this.asteroid3);
        Matter.World.add(this.engine.world, this.asteroid4);
    }

    private initAsteroid(sliceStart: number, sliceEnd: number, minSpeed: number, maxSpeed: number): Matter.Body {
        return Matter.Bodies.circle(this.getRandomIntInterval(sliceStart, sliceEnd), -50, this.asteroidSize,
            {
                label : 'Asteroid',
                velocity : {x:0 , y: this.getRandomInterval(minSpeed , maxSpeed)}
            });
    }

    private respawnAsteroids(): void{
        if(this.asteroid1 == null || this.asteroid2 == null 
            || this.asteroid3 == null || this.asteroid4 == null) return;

        if (this.asteroid1.position.y > this.getRandomIntInterval(1200, 2000) || this.asteroidReset) {
            this.resetAsteroid(this.asteroid1, 0, this.asteroidSlice);
        }
        if (this.asteroid2.position.y > this.getRandomIntInterval(1400, 2200) || this.asteroidReset) {
            this.resetAsteroid(this.asteroid2, this.asteroidSlice, 2 * this.asteroidSlice);
        }
        if (this.asteroid3.position.y > this.getRandomIntInterval(1600, 2400) || this.asteroidReset) {
            this.resetAsteroid(this.asteroid3, 2 * this.asteroidSlice, 3 * this.asteroidSlice);
        }
        if (this.asteroid4.position.y > this.getRandomIntInterval(1800, 2600) || this.asteroidReset) {
            this.resetAsteroid(this.asteroid4, 3 * this.asteroidSlice, 4 * this.asteroidSlice);
        }
        this.asteroidReset = false;
    }

    private resetAsteroid(asteroid: Matter.Body, sliceStart: number, sliceEnd: number): void {
        Matter.Body.setPosition(asteroid, {x:this.getRandomIntInterval(sliceStart, sliceEnd), y: -50})
        Matter.Body.setVelocity(asteroid, {x: 0, y: this.getRandomInterval(this.minSpeed , this.maxSpeed)})
    }

    private createWorldBoundsForSpaceShip(): void {
        if(this.engine == null) return;

        Matter.World.add(this.engine.world, [
            Matter.Bodies.rectangle(0, this.height / 2, 1, 2 * this.height, {
                label: 'Bounds',
                isStatic: true
            }),
            Matter.Bodies.rectangle(this.width, this.height / 2, 1, 2 * this.height, {
                label: 'Bounds',
                isStatic: true
            })
        ]);
    }
    
    private getRandomIntInterval(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private getRandomInterval(min: number, max: number): number {
        return Math.random() * (max - min) + min;
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
