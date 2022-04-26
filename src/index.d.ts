import { WebSocket } from "ws";
import { Jar } from "./lib/jar";
import { Room } from "./objects/room";

declare module "stackchat.js";

export class BlockTrigger {
    timer?: NodeJS.Timeout;
    events: any[];

    insert(event: any, call: function): void;
}

export class Cache<K, V> {
    max: Number;
    keys: K[];
    store: Map<K, V>;

    set(key: K, value: V): void;
    get(key: K): V;
    delete(key: K): void;
    clear(): void;
}

export class Client {
    jar: Jar;
    fkey?: String;
    rooms: Map<Number, any>;
    listeners: Map<String, Function>;
    queue: {
        url: String;
        options: RequestOptions;
        resolve: Function;
    }[];
    busy: Boolean;

    request(url: String, { ...RequestOptions }): Promise<Response>;
    login(site: String, email: String, password: String): Promise<void>;
    logout(): Promise<void>;
    joinRoom(id: Number, { messageCacheLimit: Number }): Promise<Room>;
    runQueue(): void;
    queueRequest(url: String, options: RequestOptions): Promise<Response>;
    send(room: Number, content: String): Promise<Response>;
    on(event: EventType, listener: Function): void;
    trigger(event: EventType, ...data: any[]): void;
}

export class ClientError extends Error {}
export class LoginError extends Error {}
export class MessageError extends Error {}
export class WebhookError extends Error {}

export class Room {
    client: Client;
    id: Number;
    listeners: Map<String, Function>;
    ws?: WebSocket;
    messages: Cache<Number, any>;
    name?: String;
    moveOutBuffer: BlockTrigger;
    moveInBuffer: BlockTrigger;

    toString(): String;
    fetchName(): Promise<String>;
    connectWs(): Promise<void>;
    send(content: String): Promise<Response>;
    on(event: EventType, listener: Function): void;
    trigger(event: EventType, ...data: any[]): void;
}

export function copy(object: any): any;
export function request(
    url: String,
    { ...RequestOptions, jar: Jar }
): Promise<Response>;

export type RequestOptions = { payload?: any; headers?: any; options?: any };
export type Response = { statusCode: Number; body: String };
export type EventType =
    | "messageCreate"
    | "messageUpdate"
    | "userJoin"
    | "userLeave"
    | "roomNameUpdate"
    | "messageStarUpdate"
    | "ping"
    | "messageDelete"
    | "userAccessUpdate"
    | "globalAccessUpdate"
    | "invite"
    | "messageReplyCreate"
    | "messageMoveOut"
    | "messageBlockMoveOut"
    | "messageMoveIn"
    | "messageBlockMoveIn"
    | "feedTicker"
    | "userSuspensionAdd"
    | "userSuspensionRemove";
