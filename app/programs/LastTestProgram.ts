import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class LastTest implements Program {
    private lobbyController: LobbyController;
    private ball?: Matter.Body;
    private gameLoop: any;
    private readyDisplays = 0;
    private readyControllers = 0;
    private engines: Matter.Engine[] = [];
    private walls: Matter.Body[] = [];
    private holes: Matter.Body[] = [];
    private gravityX: number = 0;
    private gravityY: number = 0;
    private wallPosition?: number[][];
    private finishField?: Matter.Body;
    private pixelSize = 0;
    private smallLevel?: number[][];
    private bigLevel?: number[][];
    private speed: number = 1;
    private endedTutorial: number = 0;
    private xAxisController?: SrcSocket;
    private yAxisController?: SrcSocket;

    private amount = 2;

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
        this.xAxisController = controllers[v];
        this.yAxisController = controllers[(v + 1) % 2];

        this.xAxisController.emit('controllerResponsibility', true);
        this.yAxisController.emit('controllerResponsibility', false);

        for(let controller of controllers){
            controller.addSocketOnce('endedTutorial', this.controllerEndedTutorial.bind(this));
        }
    }

    private controllerEndedTutorial(): void {
        this.endedTutorial++;

        this.lobbyController.sendToDisplays('controllerEndedTutorial', this.endedTutorial);

        if(this.endedTutorial == 2) {
            this.setUpGame();
            this.setControllerDataListeners();
        }
    }

    private setControllerDataListeners(): void {
        if(this.xAxisController && this.yAxisController){
            this.lobbyController.sendToControllers('startSendingData', null);

            this.xAxisController.addSocketListener('controllerData', this.setXGravity.bind(this));
            this.yAxisController.addSocketListener('controllerData', this.setYGravity.bind(this));
        }
    }

    private setXGravity(xGravity: number): void {
        this.gravityX = xGravity;
    }

    private setYGravity(yGravity: number): void {
        this.gravityY = yGravity;
    }

    private setDisplayLabyrinthBuildListener(): void {
        let displays = this.lobbyController.getDisplays();

        for(let display of displays){
            display.addSocketOnce('labyrinthBuild', this.labyrinthBuildCallback.bind(this));
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

        this.gameLoop = setInterval(() => {
            if(this.ball == null) return;

            for(let i = 0; i < this.engines.length; i++){
                this.engines[i].world.gravity.x = this.gravityX;
                this.engines[i].world.gravity.y = this.gravityY;
    
                Matter.Engine.update(this.engines[i], 1000 / fps);
            }
            
            this.lobbyController.sendToDisplays('updateLabyrinth', [this.ball.position.x, this.ball.position.y]);
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

                break;
            }
        }
    }

    controllerJoin(socket: SrcSocket): boolean {
        socket.emit('gameRunning', null);
        return false;
    }

    displayJoin(socket: SrcSocket): boolean {
        socket.emit('gameRunning', null);
        return false;
    }

    private buildWall(x: number, y: number, size: number, engine: Matter.Engine): void {
        let wall = Matter.Bodies.rectangle(x, y, size, size, {
            isStatic: true,
            label: 'Wall'
        });

        Matter.World.add(engine.world, wall);
        this.walls.push(wall);
    }

    private createHole(x: number, y: number, radius: number, engine: Matter.Engine): void {
        let hole = Matter.Bodies.circle(x, y, radius, {
            isStatic: true,
            isSensor: true,
            label: 'Hole'
        });

        Matter.World.add(engine.world, hole);
        this.holes.push(hole);
    }

    private createFinishField (x: number, y: number, size: number, engine: Matter.Engine): void {
        this.finishField = Matter.Bodies.rectangle(x, y, size, size, {
            label: 'FinishField',
            isStatic: true
        });

        Matter.World.add(engine.world, this.finishField);
    }

    private sendLevelInfoToDisplay(): void {
        if(this.finishField == null || this.ball == null) return;

        let labyrinthWalls = [];

        for(let wall of this.walls){
            labyrinthWalls.push(wall.position.x, wall.position.y, this.pixelSize, this.pixelSize)
        }

        labyrinthWalls.push(-1);

        for(let hole of this.holes){
            labyrinthWalls.push(hole.position.x, hole.position.y, hole.circleRadius);
        }

        labyrinthWalls.push(-1);

        labyrinthWalls.push(this.finishField.position.x, this.finishField.position.y, this.pixelSize, this.pixelSize);

        labyrinthWalls.push(this.ball.position.x, this.ball.position.y, this.ball.circleRadius);

        this.setDisplayLabyrinthBuildListener();
        this.lobbyController.sendToDisplays('labyrinthData', labyrinthWalls);
    }

    private resetBall(engine: Matter.Engine) : void{
        if(this.ball == null || this.wallPosition == null) return;

        Matter.World.remove(engine.world, this.ball);

        for (let i = 0; i < this.wallPosition.length; i++) {
            for (let j = 0; j < this.wallPosition[i].length; j++) {
                if (this.wallPosition[i][j] === 4) {
                    this.createBall(j*this.pixelSize + this.pixelSize / 2,i*this.pixelSize + this.pixelSize / 2, this.pixelSize / 3, engine);
                }
            }
        }
    }

    private createBall(x: number, y: number, radius: number, engine: Matter.Engine): void {
        this.ball = Matter.Bodies.circle(x, y, radius, {label: "Ball" , restitution: 0.5, mass: 1 , velocity: {x: 0, y: 0}});
        Matter.World.add(engine.world, this.ball);
    }

    private setUpGame() {
        for(let worldNr = 0; worldNr < this.amount; worldNr++){
            let width = 1920;
            let height = 1080;


            this.engines.push(Matter.Engine.create());

            this.smallLevel = [
                [1, 1, 1, 1, 1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1],
                [1, 4, 0, 1, 0, 0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0, 0 ,0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 0, 0, 1, 0, 0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,2 ,0 ,0 ,0, 0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 0, 0, 1, 0, 0 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,2 ,0 ,1],
                [1, 0, 0, 1, 0, 0 ,1 ,0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0, 0 ,0 ,0 ,0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 0, 0, 1, 2, 0 ,1 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,2 ,0 ,0, 0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 0, 0, 1, 0, 0 ,1 ,0 ,0 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1],
                [1, 0, 0, 1, 0, 0 ,1 ,2 ,0 ,1 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0, 0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 0, 0, 1, 0, 0 ,1 ,0 ,0 ,1 ,0 ,0 ,0 ,0 ,2 ,0 ,0 ,0, 0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,2 ,1],
                [1, 0, 0, 2, 0, 0 ,1 ,0 ,0 ,1 ,0 ,0 ,1 ,1 ,1 ,1 ,0 ,2, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1],
                [1, 0, 0, 0, 0, 0 ,1 ,0 ,0 ,1 ,0 ,0 ,0 ,0 ,2 ,1 ,0 ,0, 1 ,2 ,0 ,0 ,0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,2 ,1],
                [1, 1, 1, 1, 1, 1 ,1 ,0 ,0 ,1 ,0 ,0 ,0 ,0 ,0 ,1 ,0 ,0, 1 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1],
                [1, 2, 0, 0, 0, 0 ,0 ,2 ,0 ,1 ,0 ,0 ,0 ,0 ,0 ,1 ,0 ,0, 1 ,0 ,0 ,2 ,0 ,0 ,0 ,2 ,0 ,0 ,1 ,0 ,0 ,1],
                [1, 0, 0, 0, 0, 0 ,0 ,0 ,0 ,1 ,2 ,0 ,0 ,0 ,0 ,1 ,0 ,0, 1 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,1 ,0 ,0 ,1],
                [1, 0, 0, 1, 1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,0 ,0 ,1 ,0 ,0, 1 ,0 ,0 ,2 ,0 ,0 ,2 ,0 ,0 ,0 ,1 ,0 ,0 ,1],
                [1, 0, 0, 0, 0, 0 ,0 ,0 ,2 ,0 ,0 ,0 ,0 ,0 ,0 ,1 ,0 ,0, 0 ,0 ,0 ,1 ,0 ,0 ,0 ,0 ,0 ,0 ,1 ,0 ,0 ,1],
                [1, 2, 0, 0, 0, 0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,0 ,2 ,1 ,2 ,0, 0 ,0 ,0 ,1 ,2 ,0 ,0 ,0 ,0 ,2 ,1 ,0 ,3 ,1],
                [1, 1, 1, 1, 1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1, 1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1 ,1]
            ];

            this.bigLevel = [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            ];

            // Change Level
            this.wallPosition = this.smallLevel;

            this.pixelSize = height / this.wallPosition.length;
            let halfPixelSize = this.pixelSize / 2;

            for (let i = 0; i < this.wallPosition.length; i++) {
                for (let j = 0; j < this.wallPosition[i].length; j++) {
                    if (this.wallPosition[i][j] === 1) {
                        this.buildWall(j*this.pixelSize + halfPixelSize,i*this.pixelSize + halfPixelSize, this.pixelSize, this.engines[worldNr]);
                    } else if (this.wallPosition[i][j] === 2) {
                        this.createHole(j*this.pixelSize + halfPixelSize,i*this.pixelSize + halfPixelSize, halfPixelSize / 2, this.engines[worldNr]);
                    } else if (this.wallPosition[i][j] === 3) {
                        this.createFinishField(j*this.pixelSize + halfPixelSize,i*this.pixelSize + halfPixelSize, this.pixelSize, this.engines[worldNr]);
                    } else if (this.wallPosition[i][j] === 4) {
                        this.createBall(j*this.pixelSize + halfPixelSize,i*this.pixelSize + halfPixelSize, this.pixelSize / 3, this.engines[worldNr]);
                    }
                }
            }

            Matter.Events.on(this.engines[worldNr], 'collisionStart', (event) => {
                const pairs = event.pairs;

                let i = 0, j = pairs.length;
                for (; i != j; ++i) {
                    const pair = pairs[i];

                    if(worldNr == 0){
                        if (pair.bodyA.label === 'Hole' || pair.bodyB.label === 'Hole') {
                            if (pair.bodyA.label === 'Ball') {
                                this.resetBall(this.engines[worldNr]);
                            } else if (pair.bodyB.label === 'Ball') {
                                this.resetBall(this.engines[worldNr]);
                            }
                        }
                        if (pair.bodyA.label === 'FinishField' || pair.bodyB.label === 'FinishField') {
                            if (pair.bodyA.label === 'Ball') {
                                this.resetBall(this.engines[worldNr]);
                            } else if (pair.bodyB.label === 'Ball') {
                                this.resetBall(this.engines[worldNr]);
                            }
                        }
                    }
                }
            });
        }
        this.sendLevelInfoToDisplay();
    }
}
