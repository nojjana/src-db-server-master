import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { SrcSocket } from "../SrcSocket";

export class MainMenuProgramm implements Program {
    private games: string[] = ["Labyrinth", "Spaceship", "Whack-a-mole"];
    private lobbyController: LobbyController;
    private selectedGame = 0;
    private mainControllerSocketId: string = "";

    constructor(lobbyController: LobbyController){
        this.lobbyController = lobbyController;

        let displays = this.lobbyController.getDisplays();

        if(displays.length == 0){
            return;
        }

        for(let display of displays){
            display.addSocketOnce('displayMainMenuReady', this.sendCurrentStateToDisplays.bind(this));
        }

        let controllers = this.lobbyController.getControllers();
        if(controllers.length > 0){
            controllers[0].addSocketOnce('controllerMainMenuReady', this.setMainController.bind(this));
        }
    }

    /* Lets a display join a socket-room and the lobby 
    Notifies all displays about the current program and its state */
    public displayJoin(socket: SrcSocket): boolean {
        socket.join(this.lobbyController.getDisplaySocketRoom());
        this.lobbyController.getDisplays().push(socket);

        this.lobbyController.sendToDisplays('currentProgram', ProgramName.MAIN_MENU);
        this.sendCurrentStateToDisplays();

        return true;
    }

    /* Lets a controller join a socket-room and the lobby
    Notifies all displays about the current program and its state */
    public controllerJoin(socket: SrcSocket): boolean {
        if(this.lobbyController.getControllers().length >= 2){
            socket.emit('lobbyFullControllers', null);
            return false;
        }

        socket.join(this.lobbyController.getControllerSocketRoom());
        this.lobbyController.getControllers().push(socket);

        this.lobbyController.sendToControllers('currentProgram', ProgramName.MAIN_MENU);

        this.sendCurrentStateToDisplays();
        
        /* If it's the first controller to join the lobby
        the controller will be the main-controller */
        if(this.lobbyController.getControllers().length == 2){
            this.setMainController();
        }

        return true;
    }

    /* Decreases the index of the currently selected game
    Sends the update to all displays */
    private controllerPressedUp(): void {
        if(this.lobbyController.getControllers().length == 2 && this.selectedGame > 0){
            this.selectedGame--;
            this.sendCurrentStateToDisplays();
        }
    }

    /* Increases the index of the currently selected game
    Sends the update to all displays */
    private controllerPressedDown(): void {
        if(this.lobbyController.getControllers().length == 2 && this.selectedGame < this.games.length - 1){
            this.selectedGame++;
            this.sendCurrentStateToDisplays();
        }
    }

    /* Changes the program (+2, because the first two Elements in the Enum aren't 
    selectable games MAIN_MENU, NOT_IN_LOBBY) all listeners from the main-controller
    get removed, so that later on the listeners aren't added twice */
    private controllerPressedSelect(): void {
        if(this.lobbyController.getControllers().length == 2){
            this.lobbyController.changeProgram(this.selectedGame + 2);
        }
    }

    /* Lets a socket leave the current lobby and notifies all displays about the changes */
    public socketLeft(socketId: string): void {
        let displays = this.lobbyController.getDisplays();
        let controllers = this.lobbyController.getControllers();

        let wasDisplay = false;

        /* If the socket is a display, all listeners are removed
        so that socket.on() listeners aren't added twice once the socket may reconnect */
        for (let i = 0; i < displays.length; i++) {
            if(displays[i].id === socketId){
                displays[i].removeAbsolutelyAllListeners();
                displays.splice(i, 1);
                wasDisplay = true;
                break;
            }
        }

        if(!wasDisplay){
            /* If the socket is a controller, all listeners are removed
            so that socket.on() listeners aren't added twice once the socket may reconnect */
            for (let i = 0; i < controllers.length; i++) {
                if(controllers[i].id === this.mainControllerSocketId){
                    controllers[i].emit('mainController', false);
                    controllers[i].removeListener('controllerPressedEnter');
                    controllers[i].removeListener('controllerPressedUp');
                    controllers[i].removeListener('controllerPressedDown');
                }

                if(controllers[i].id === socketId){
                    controllers[i].removeAbsolutelyAllListeners();
                    controllers.splice(i, 1);
                }
            }
        }
        
        this.sendCurrentStateToDisplays();
    }

    /* Assigns listeners for the main-controller and signals the upgrade */
    private setMainController() {
        if(this.lobbyController.getControllers().length != 2){
            return;
        }

        let mainController = this.lobbyController.getControllers()[0];

        if(mainController != null){
            mainController.addSocketListener('controllerPressedEnter', this.controllerPressedSelect.bind(this));
            mainController.addSocketListener('controllerPressedUp', this.controllerPressedUp.bind(this));
            mainController.addSocketListener('controllerPressedDown', this.controllerPressedDown.bind(this));
    
            this.mainControllerSocketId = mainController.id;
    
            mainController.emit('mainController', true);
            this.lobbyController.getControllers()[1].emit('mainController', false);
        }
    }

    /* Gathers all information about the state of the main-menu and sends it to all displays */
    public sendCurrentStateToDisplays(): void {
        let content = {
            lobbyCode: this.lobbyController.getLobbyCode(),
            displays: this.lobbyController.getAmountOfDisplays(),
            controllers: this.lobbyController.getAmountOfControllers(),
            selectedGame: this.selectedGame,
            games: this.games
        }

        this.lobbyController.sendToDisplays('mainMenuState', content);
    }
}