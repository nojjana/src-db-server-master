import { SrcSocket } from "../SrcSocket";

export interface Program {
    displayJoin(socket: SrcSocket): boolean;
    socketLeft(socketId: string): void;
    controllerJoin(socket: SrcSocket): boolean;
}


export enum ProgramName {
    NOT_IN_LOBBY,
    MAIN_MENU,
    LABYRINTH,
    SPACESHIP,
    WHACK_A_MOLE,
    SHAKER,
    CATCHER,
    SEESAW,
    VARIANZ_TEST,
    LAST_TEST,
}