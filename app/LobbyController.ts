import { Program, ProgramName } from "./programs/Program";
import { MainMenuProgramm } from "./programs/MainMenuProgram";
import { LabyrinthProgram } from "./programs/LabyrinthProgram";
import { SpaceshipProgram } from "./programs/SpaceshipProgram";
import { WhackAMoleProgram } from "./programs/WhackAMoleProgram";
import { ShakerProgram } from "./programs/ShakerProgram";
import { SrcSocket } from "./SrcSocket";
import { VarianzTest } from "./programs/VarianzTestProgram";
import { LastTest } from "./programs/LastTestProgram";

export class LobbyController {
    private lobbyCode: number;
    private displaysSocketRoom: string;
    private controllerSocketRoom: string;
    private displays: SrcSocket[] = [];
    private controllers: SrcSocket[] = [];
    private program: Program;
    private io: any;

    constructor(lobbyCode: number, io: any){
        this.lobbyCode = lobbyCode;

        /* Creates a unique room code for all displays and controllers to listen to that connect later on */
        this.displaysSocketRoom = 'b' + this.lobbyCode.toString();
        this.controllerSocketRoom = 'c' + this.lobbyCode.toString();

        this.io = io;

        /* Initializing the default Program */
        this.program = new MainMenuProgramm(this);
    }

    /* Checks wether a socket is present in this lobby */
    public hasSocket(socket: SrcSocket): boolean {
        return this.displays.includes(socket) || this.controllers.includes(socket);
    } 

    /* Changes the Program according to the Main Menu Program */
    public changeProgram(programNr: number): void {
        this.removeAllSocketListeners();

        let newProgram: Program | null;

        switch(programNr) { 
            case ProgramName.LABYRINTH: {
                newProgram = new LabyrinthProgram(this);
                break;
            }
            case ProgramName.SPACESHIP: {
                newProgram = new SpaceshipProgram(this);
                break;
            }
            case ProgramName.WHACK_A_MOLE: {
                newProgram = new WhackAMoleProgram(this);
                break;
            }
            case ProgramName.SHAKER: {
                newProgram = new ShakerProgram(this);
                break;
            }
            case ProgramName.MAIN_MENU: {
                newProgram = new MainMenuProgramm(this);
                break;
            }
            case ProgramName.VARIANZ_TEST: {
                newProgram = new VarianzTest(this);
                break;
            }
            case ProgramName.LAST_TEST: {
                newProgram = new LastTest(this);
                break;
            }
            default: {
                newProgram = null;
            }
        }

        /* Notification to all sockets to change their views accordingly */
        if(newProgram != null){
            this.program = newProgram;
            this.sendToControllers('currentProgram', programNr);
            this.sendToDisplays('currentProgram', programNr);
        }
    }

    public removeAllSocketListeners(): void {
        this.controllers.forEach((srcSocket: SrcSocket) => srcSocket.removeAllSocketListeners());
        this.displays.forEach((srcSocket: SrcSocket) => srcSocket.removeAllSocketListeners());
    }

    /* Delegates leaving of a socket to a Program
    Returns wether or not the lobby can be deleted */
    public socketLeft(socketId: string): boolean {
        this.program.socketLeft(socketId);

        return this.displays.length == 0;
    }

    /* Delegates joining of a display to a Program */
    public displayJoins(socket: SrcSocket): boolean {
        return this.program.displayJoin(socket);
    }

    /* Delegates joining of a controller to a Program */
    public controllersJoins(socket: SrcSocket): boolean {
        return this.program.controllerJoin(socket);
    }

    /* Sends a message to all displays in the lobby */
    public sendToDisplays(eventName: string, content: any): void {
        this.io.to(this.displaysSocketRoom).emit(eventName, content);
    }

    /* Sends a message to all controllers in the lobby */
    public sendToControllers(eventName: string, content: any): void {
        this.io.to(this.controllerSocketRoom).emit(eventName, content);
    }

    /* Returns the name of the room to which all displays of this lobby listen to */
    public getDisplaySocketRoom(): string {
        return this.displaysSocketRoom;
    }

    /* Returns the name of the room to which all controllers of this lobby listen to */
    public getControllerSocketRoom(): string {
        return this.controllerSocketRoom;
    }

    /* Returns all displays in the lobby */
    public getDisplays(): SrcSocket[] {
        return this.displays;
    }

    /* Returns all controllers in the lobby*/
    public getControllers(): SrcSocket[] {
        return this.controllers;
    }

    /* Return the lobby code */
    public getLobbyCode(): number {
        return this.lobbyCode;
    }

    /* Returns the amount of displays in the lobby*/
    public getAmountOfDisplays(): number {
        return this.displays.length;
    }

    /* Returns the amount of controllers in the lobby */
    public getAmountOfControllers(): number {
        return this.controllers.length;
    }
}