import { Socket } from "socket.io";

export class SrcSocket {
    private socket: Socket;
    private listenerCallbacks = new Map<string, (...args: any[]) => void>();
    private onceCallbacks = new Map<string, any>();
    public id: string;

    constructor(socket: Socket){
        this.socket = socket;
        this.id = socket.id;
    }
    
    public addSocketListener(name: string, fnc: (...args: any[]) => void): void {
        this.listenerCallbacks.set(name, fnc);
        this.socket.addListener(name, fnc);
    }

    public removeSocketListener(name: string): void {
        if(this.listenerCallbacks.has(name)){
            let fn = this.listenerCallbacks.get(name)
            if(fn != null){
                this.socket.removeListener(name, fn);
                this.listenerCallbacks.delete(name);
            }
        }   
    }

    public addSocketOnce(name: string, fnc: (...args: any[]) => void): void {
        this.socket.once(name, fnc);
        this.onceCallbacks.set(name, fnc);
    }

    public join(name: string): void {
        this.socket.join(name);
    }

    public emit(name: string, data: any): void {
        this.socket.emit(name, data);
    }

    public removeAbsolutelyAllListeners(): void {
        this.socket.removeAllListeners();
    }

    public removeListener(name: string): void {
        let fnc = this.listenerCallbacks.get(name);

        if(fnc != null){
            this.socket.removeListener(name, fnc);
            this.listenerCallbacks.delete(name);
        }
    }

    public removeAllSocketListeners(): void {        
        for(let callbackName of Array.from(this.listenerCallbacks.keys())){
            let fnc = this.listenerCallbacks.get(callbackName);
            if(fnc != null){
                this.socket.removeListener(callbackName, fnc);
            }
        }

        for(let callbackName of Array.from(this.onceCallbacks.keys())){
            let fnc = this.listenerCallbacks.get(callbackName);
            if(fnc != null){
                this.socket.removeListener(callbackName, fnc);
            }
        }

        this.onceCallbacks = new Map();
        this.listenerCallbacks = new Map();
    }
}
